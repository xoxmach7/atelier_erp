"""
Management command to dump the production Postgres database and upload it
to the existing R2 (S3-compatible) media bucket, under a separate prefix.

Security-аудит #6: не было ни одного подтверждённого способа сделать бэкап
БД, кроме того, что предположительно включено на стороне Railway (не
проверено). Управляемый Postgres-плагин Railway не даёт готового тумблера
"включить автобэкапы" — нужен собственный процесс, запускаемый по расписанию
(Railway Cron на отдельном сервисе; см. docs/security-audit/DB_BACKUP_SETUP.md).

Использует pg_dump (custom format, -Fc) — единственный способ, гарантирующий
восстановление через pg_restore со всеми индексами/constraints, в отличие от
manage.py dumpdata (JSON, теряет часть структуры БД). Требует pg_dump в PATH
(добавлен в Dockerfile, см. комментарий там про версию сервера).

Usage: python manage.py backup_database [--keep N]

Требуемые переменные окружения:
  DATABASE_URL             — как обычно у Django (используется для параметров подключения)
  AWS_ACCESS_KEY_ID        — R2 Access Key ID (те же, что для медиа-хранилища)
  AWS_SECRET_ACCESS_KEY    — R2 Secret Access Key
  AWS_STORAGE_BUCKET_NAME  — тот же bucket, что и для медиа (backups лежат в своём префиксе)
  AWS_S3_ENDPOINT_URL      — endpoint R2
"""
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlparse

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

BACKUP_PREFIX = 'backups/'
DEFAULT_KEEP = 14


class Command(BaseCommand):
    help = 'Dump the database (pg_dump -Fc) and upload it to the R2 backups/ prefix, pruning old backups.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep', type=int, default=DEFAULT_KEEP,
            help=f'How many most recent backups to keep in storage (default: {DEFAULT_KEEP}).',
        )

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        if db['ENGINE'] != 'django.db.backends.postgresql':
            raise CommandError('backup_database поддерживает только PostgreSQL')

        bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME')
        if not bucket:
            raise CommandError('AWS_STORAGE_BUCKET_NAME не задан — некуда загружать бэкап')

        timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        key = f'{BACKUP_PREFIX}{timestamp}.dump'

        # mkstemp вместо NamedTemporaryFile: pg_dump открывает файл как
        # отдельный процесс по тому же пути — на Windows второй open() на файл
        # с уже открытым дескриптором (как держит NamedTemporaryFile) падает
        # PermissionError. Закрываем fd сразу и оставляем pg_dump/сам файл.
        fd, tmp_path = tempfile.mkstemp(suffix='.dump')
        os.close(fd)
        try:
            self._run_pg_dump(db, tmp_path)
            size = os.path.getsize(tmp_path)
            if size == 0:
                raise CommandError('pg_dump создал пустой файл — прерываю, не загружаю в R2')
            self._upload(tmp_path, bucket, key)
        finally:
            os.remove(tmp_path)

        self.stdout.write(self.style.SUCCESS(f'Бэкап загружен: s3://{bucket}/{key} ({size} байт)'))
        self._prune_old_backups(bucket, keep=options['keep'])

    def _run_pg_dump(self, db, output_path):
        env = os.environ.copy()
        if db.get('PASSWORD'):
            env['PGPASSWORD'] = db['PASSWORD']
        cmd = [
            'pg_dump',
            '-Fc',
            '-h', db['HOST'] or 'localhost',
            '-p', str(db.get('PORT') or 5432),
            '-U', db['USER'],
            '-f', output_path,
            db['NAME'],
        ]
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            raise CommandError(f'pg_dump упал (код {result.returncode}): {result.stderr}')

    def _s3_client(self):
        import boto3
        return boto3.client(
            's3',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
            endpoint_url=os.environ.get('AWS_S3_ENDPOINT_URL'),
            region_name=os.environ.get('AWS_S3_REGION_NAME', 'auto'),
        )

    def _upload(self, local_path, bucket, key):
        self._s3_client().upload_file(local_path, bucket, key)

    def _prune_old_backups(self, bucket, keep):
        client = self._s3_client()
        response = client.list_objects_v2(Bucket=bucket, Prefix=BACKUP_PREFIX)
        objects = sorted(response.get('Contents', []), key=lambda o: o['Key'])
        stale = objects[:-keep] if keep > 0 else objects
        for obj in stale:
            client.delete_object(Bucket=bucket, Key=obj['Key'])
        if stale:
            self.stdout.write(f'Удалено старых бэкапов: {len(stale)} (оставлено {min(keep, len(objects))})')
