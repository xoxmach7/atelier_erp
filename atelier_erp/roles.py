"""
Atelier ERP — единый реестр ролей (групп пользователей).

ЕДИНСТВЕННЫЙ источник истины для имён групп. На него обязаны опираться:
  - management/commands/seed_groups.py  — создание групп
  - api/permissions.py                  — проверки доступа
  - frontend src/hooks/useRole.ts       — GROUP_TO_ROLE (те же строки)

Раньше имена расходились (seed создавал 'Manager'/'Installer', а проверки
искали 'Owner'/'Installation'/'Worker'), из-за чего RBAC фактически не работал.
Не хардкодить имена групп нигде, кроме этого файла.
"""


class Roles:
    # Владелец/Админ — одно лицо: полное управление бизнесом и заказами,
    # ведёт финансы (отдельной роли Finance в бизнес-модели нет).
    OWNER = "Owner"
    # Замерщик/дизайнер: заказы, замеры, КП.
    DESIGNER = "Designer"
    # Склад/снабжение: только задачи по материалам.
    WAREHOUSE = "Warehouse"
    # Швейный цех: только производственные задачи.
    SEAMSTRESS = "Seamstress"
    # Монтажник: только установка и закрытие заказа.
    INSTALLER = "Installer"

    ALL = [OWNER, DESIGNER, WAREHOUSE, SEAMSTRESS, INSTALLER]

    # Роли, которым разрешён полный список всех заказов компании.
    # Все остальные роли видят только свой операционный срез (см. OrderViewSet.get_queryset).
    FULL_ORDER_ACCESS = [OWNER, DESIGNER]

    # Роли, которым видны финансовые поля заказа (суммы, оплаты, баланс).
    # Дизайнер видит суммы, т.к. формирует КП. Склад/цех/монтаж — нет.
    FINANCIAL_ACCESS = [OWNER, DESIGNER]

    DESCRIPTIONS = {
        OWNER: "Владелец/Админ — полное управление бизнесом, заказами и финансами",
        DESIGNER: "Замерщик/дизайнер — заказы, замеры, КП",
        WAREHOUSE: "Склад — обеспечение материалами",
        SEAMSTRESS: "Швейный цех — производственные задачи",
        INSTALLER: "Монтажник — установка и закрытие заказа",
    }

    # Группы из прежнего сидера, которые мигрируются в каноничные (см. миграцию 0012).
    # Используется только для обратной совместимости / data-migration.
    LEGACY_ALIASES = {
        "Manager": OWNER,
        "Admin": OWNER,
        "Finance": OWNER,
        "Installation": INSTALLER,
        "Worker": None,  # generic — не маппится, попадает под default deny
    }


def user_in(user, *role_names):
    """Хелпер: состоит ли пользователь хотя бы в одной из перечисленных ролей.

    Суперпользователь приравнивается к Owner (полный доступ).
    Понимает легаси-имена групп как алиасы (Manager/Admin/Finance -> Owner,
    Installation -> Installer) на случай, если канонизация ещё не раскатана
    или в БД остались старые группы.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    # Прямое совпадение с каноничными именами
    names = set(role_names)
    # Плюс легаси-алиасы, указывающие на запрошенные роли
    names.update(
        old for old, canon in Roles.LEGACY_ALIASES.items()
        if canon in role_names
    )
    return user.groups.filter(name__in=names).exists()
