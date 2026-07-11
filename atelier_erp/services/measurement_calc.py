"""
Расчёт метража ткани из замеров.

Метраж — производное от замеров, а не ручной ввод. Считается по модели «сборка»:
метраж гонится по ширине окна с коэффициентом сборки; высота окна в погонный
метраж не входит (уходит в раскрой по ширине рулона).

Единственная точка изменения правила округления — функция `ceil_to_tenth`.
"""

from decimal import Decimal, ROUND_CEILING

_TENTH = Decimal('0.1')


def ceil_to_tenth(value: Decimal) -> Decimal:
    """Округление вверх до ближайших 0.1 м."""
    return value.quantize(_TENTH, rounding=ROUND_CEILING)


def compute_meters(width_cm, gathering, has_fabric: bool) -> Decimal:
    """
    Метраж ткани для одного окна.

    Args:
        width_cm: ширина окна в см
        gathering: коэффициент сборки (напр. 2.2 для штор, 2.0 для тюля)
        has_fabric: выбрана ли ткань для этого слоя (шторы/тюль)

    Returns:
        Метраж в метрах (Decimal), округл. вверх до 0.1 м; 0 если ткань не выбрана.
    """
    if not has_fabric:
        return Decimal('0')
    width = Decimal(str(width_cm or 0))
    ratio = Decimal(str(gathering or 0))
    meters = width * ratio / Decimal('100')
    return ceil_to_tenth(meters)
