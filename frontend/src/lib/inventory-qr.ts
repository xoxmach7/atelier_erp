/**
 * Содержимое QR-этикетки материала склада — стабильный указатель на id
 * позиции, не сами данные (остаток/цена постоянно меняются, печатная
 * этикетка — нет). При сканировании приложение всегда идёт за актуальными
 * данными в API.
 */
const INVENTORY_QR_PREFIX = "SHEBER-INV:";

export function buildInventoryQrValue(id: string): string {
  return `${INVENTORY_QR_PREFIX}${id}`;
}
