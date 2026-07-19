"""
Расчёт стоимости окна из выбранных тканей.

Цена окна перестала быть ручным вводом: она выводится из того, что уже
выбрано в замере — ткань штор, ткань тюля и посчитанный метраж (см.
`measurement_calc.compute_meters`). Формула простая и намеренно прозрачная:

    стоимость слоя = метраж × цена ткани за метр
    стоимость окна = (шторы + тюль) × количество изделий

Почему только ткань. Пошив, карниз и установка в этот расчёт НЕ входят:
  * ставки пошива в `constants.SewingRates` — это заготовка времён разработки,
    ателье их не подтверждало; подставлять их значило бы выдать выдуманные
    цифры за расчёт;
  * установка уже задаётся отдельным полем в КП и не привязана к окну;
  * карниз в замере не выбирается.
Когда ателье назовёт свои ставки — расширять надо здесь, в одной функции,
а не в сериализаторах и не на клиентах.

Единая точка правды: и веб, и мобилка получают готовую цену с сервера
(`Measurement.calculated_price`), своей копии формулы не держат.
"""

from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal('0.01')


def _money(value: Decimal) -> Decimal:
    """Округление денежной суммы до копеек."""
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def layer_cost(meters, price_per_meter) -> Decimal:
    """Стоимость одного слоя (шторы или тюль): метраж × цена за метр."""
    if not meters or price_per_meter is None:
        return Decimal('0.00')
    m = Decimal(str(meters))
    price = Decimal(str(price_per_meter))
    if m <= 0 or price <= 0:
        return Decimal('0.00')
    return _money(m * price)


def window_price_breakdown(measurement) -> dict:
    """
    Разбор стоимости окна.

    Возвращает словарь со стоимостью слоёв, количеством и итогом.
    Разбор, а не одно число: в КП поля `fabric_cost`/`tulle_cost` хранятся
    отдельно, и интерфейсу полезно показать, из чего сложилась сумма.

    Ткань может быть не выбрана или у неё может не быть цены — тогда слой
    стоит 0, а не роняет расчёт.
    """
    curtain_fabric = getattr(measurement, 'curtain_fabric', None)
    tulle_fabric = getattr(measurement, 'tulle_fabric', None)

    curtain_cost = layer_cost(
        getattr(measurement, 'curtain_meters', 0),
        getattr(curtain_fabric, 'price_per_meter', None),
    )
    tulle_cost = layer_cost(
        getattr(measurement, 'tulle_meters', 0),
        getattr(tulle_fabric, 'price_per_meter', None),
    )

    quantity = int(getattr(measurement, 'quantity', 1) or 1)
    if quantity < 1:
        quantity = 1

    per_item = curtain_cost + tulle_cost
    return {
        'curtain_cost': curtain_cost,
        'tulle_cost': tulle_cost,
        'per_item': _money(per_item),
        'quantity': quantity,
        'total': _money(per_item * quantity),
    }


def window_price(measurement) -> Decimal:
    """Итоговая стоимость окна с учётом количества изделий."""
    return window_price_breakdown(measurement)['total']
