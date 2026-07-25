"""
Security-аудит #8 (Medium, 2026-07-20): группа Owner получала все Django
Permission объекты через seed_groups.py — latentная эскалация, если
когда-либо у обычного Owner-сотрудника (не superuser) окажется is_staff=True.
Ни один Owner-аккаунт в системе сегодня is_staff не имеет (только
единственный superuser, который и так обходит все проверки прав) — эти
permissions ничего не давали функционально, доступ к API целиком построен на
кастомных permission-классах (atelier_erp/api/permissions.py), не на
DjangoModelPermissions. Убираем уже накопленные в БД permissions у группы
Owner той же миграцией, что и код-фикс в seed_groups.py.
"""
from django.db import migrations


def strip_owner_permissions(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    for group in Group.objects.filter(name='Owner'):
        group.permissions.clear()


def noop_reverse(apps, schema_editor):
    # Осознанно необратимо: старое поведение (все permissions) было
    # признанным риском аудита, восстанавливать его откатом миграции не нужно.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('atelier_erp', '0033_materialdeduction_order_item'),
    ]

    operations = [
        migrations.RunPython(strip_owner_permissions, noop_reverse),
    ]
