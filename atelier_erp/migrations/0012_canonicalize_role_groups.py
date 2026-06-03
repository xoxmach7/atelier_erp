"""
Канонизация групп-ролей.

Прежний сидер и проверки прав использовали разные имена групп
(Manager/Installer vs Owner/Installation/Worker), из-за чего RBAC не работал.
Эта миграция приводит существующие группы к единому реестру atelier_erp.roles.Roles
и переносит пользователей из старых групп в каноничные, чтобы никто не потерял доступ.

Идемпотентна и безопасна: если старых групп нет — ничего не делает.
"""

from django.db import migrations


CANONICAL = ["Owner", "Designer", "Warehouse", "Seamstress", "Installer"]

# Старое имя группы -> каноничное
RENAMES = {
    "Manager": "Owner",
    "Admin": "Owner",
    "Finance": "Owner",
    "Installation": "Installer",
}


def canonicalize(apps, schema_editor):
    Group = apps.get_model("auth", "Group")

    # Гарантируем наличие всех каноничных групп
    canonical = {name: Group.objects.get_or_create(name=name)[0] for name in CANONICAL}

    for old_name, new_name in RENAMES.items():
        try:
            old = Group.objects.get(name=old_name)
        except Group.DoesNotExist:
            continue

        target = canonical[new_name]
        if old.pk == target.pk:
            continue

        # Переносим пользователей старой группы в каноничную
        for user in old.user_set.all():
            user.groups.add(target)

        old.delete()


def noop(apps, schema_editor):
    # Обратная миграция не восстанавливает старые имена — это безопасно,
    # т.к. каноничные группы остаются рабочими.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("atelier_erp", "0011_alter_order_status_and_more"),
        ("auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(canonicalize, noop),
    ]
