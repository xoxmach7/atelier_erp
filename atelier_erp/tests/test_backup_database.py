"""
Тесты на management-команду backup_database (security-аудит #6).
Мокают subprocess.run (pg_dump) и boto3.client (R2) — не бьют по реальной БД/сети.

Запуск: python manage.py test atelier_erp.tests.test_backup_database -v 2
"""
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings


POSTGRES_DB = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'railway',
        'USER': 'postgres',
        'PASSWORD': 'secret',
        'HOST': 'postgres.railway.internal',
        'PORT': 5432,
    }
}

R2_ENV = {
    'AWS_ACCESS_KEY_ID': 'key',
    'AWS_SECRET_ACCESS_KEY': 'secret',
    'AWS_STORAGE_BUCKET_NAME': 'sheber-media',
    'AWS_S3_ENDPOINT_URL': 'https://example.r2.cloudflarestorage.com',
}


def _fake_pg_dump_writes_content(cmd, **kwargs):
    output_path = cmd[cmd.index('-f') + 1]
    with open(output_path, 'wb') as f:
        f.write(b'fake dump bytes')
    return mock.Mock(returncode=0, stderr='')


class BackupDatabaseCommandTests(TestCase):
    def test_raises_if_not_postgres(self):
        # settings_test.py использует sqlite3 — команда должна отказаться сразу.
        with self.assertRaises(CommandError):
            call_command('backup_database')

    @override_settings(DATABASES=POSTGRES_DB)
    def test_raises_if_no_bucket_env(self):
        with mock.patch.dict('os.environ', {}, clear=False):
            import os
            os.environ.pop('AWS_STORAGE_BUCKET_NAME', None)
            with self.assertRaises(CommandError):
                call_command('backup_database')

    @override_settings(DATABASES=POSTGRES_DB)
    def test_pg_dump_failure_raises_and_does_not_upload(self):
        with mock.patch.dict('os.environ', R2_ENV), \
             mock.patch('atelier_erp.management.commands.backup_database.subprocess.run') as run_mock, \
             mock.patch('boto3.client') as client_mock:
            run_mock.return_value = mock.Mock(returncode=1, stderr='connection refused')
            with self.assertRaises(CommandError):
                call_command('backup_database')
            client_mock.assert_not_called()

    @override_settings(DATABASES=POSTGRES_DB)
    def test_empty_dump_raises_and_does_not_upload(self):
        with mock.patch.dict('os.environ', R2_ENV), \
             mock.patch('atelier_erp.management.commands.backup_database.subprocess.run') as run_mock, \
             mock.patch('boto3.client') as client_mock:
            run_mock.return_value = mock.Mock(returncode=0, stderr='')
            with self.assertRaises(CommandError):
                call_command('backup_database')
            client_mock.assert_not_called()

    @override_settings(DATABASES=POSTGRES_DB)
    def test_successful_backup_uploads_with_timestamped_key(self):
        with mock.patch.dict('os.environ', R2_ENV), \
             mock.patch('atelier_erp.management.commands.backup_database.subprocess.run',
                        side_effect=_fake_pg_dump_writes_content), \
             mock.patch('boto3.client') as client_mock:
            s3 = client_mock.return_value
            s3.list_objects_v2.return_value = {'Contents': []}
            call_command('backup_database')

            self.assertEqual(s3.upload_file.call_count, 1)
            _local_path, bucket, key = s3.upload_file.call_args[0]
            self.assertEqual(bucket, 'sheber-media')
            self.assertTrue(key.startswith('backups/'))
            self.assertTrue(key.endswith('.dump'))

    @override_settings(DATABASES=POSTGRES_DB)
    def test_prune_keeps_only_most_recent_n(self):
        existing = [{'Key': f'backups/{i:02d}.dump'} for i in range(20)]
        with mock.patch.dict('os.environ', R2_ENV), \
             mock.patch('atelier_erp.management.commands.backup_database.subprocess.run',
                        side_effect=_fake_pg_dump_writes_content), \
             mock.patch('boto3.client') as client_mock:
            s3 = client_mock.return_value
            s3.list_objects_v2.return_value = {'Contents': existing}
            call_command('backup_database', keep=14)

            # 20 существующих + 1 новый = 21 объект по одному и тому же префиксу
            # с точки зрения list_objects_v2 (мок не добавляет новый ключ в
            # список сам — проверяем только что prune вызвался на переданных
            # 20 и удалил разницу до keep=14).
            self.assertEqual(s3.delete_object.call_count, 6)

    @override_settings(DATABASES=POSTGRES_DB)
    def test_pg_dump_invoked_with_correct_connection_params(self):
        with mock.patch.dict('os.environ', R2_ENV), \
             mock.patch('atelier_erp.management.commands.backup_database.subprocess.run',
                        side_effect=_fake_pg_dump_writes_content) as run_mock, \
             mock.patch('boto3.client') as client_mock:
            client_mock.return_value.list_objects_v2.return_value = {'Contents': []}
            call_command('backup_database')

            cmd = run_mock.call_args[0][0]
            self.assertIn('pg_dump', cmd)
            self.assertIn('-Fc', cmd)
            self.assertIn('postgres.railway.internal', cmd)
            self.assertIn('railway', cmd)
            env_used = run_mock.call_args[1]['env']
            self.assertEqual(env_used['PGPASSWORD'], 'secret')
