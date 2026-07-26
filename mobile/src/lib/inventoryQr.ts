/**
 * Содержимое QR-этикетки материала склада — та же схема, что и на вебе
 * (frontend/src/lib/inventory-qr.ts): стабильный указатель на id позиции,
 * не сами данные (остаток/цена постоянно меняются, печатная этикетка — нет).
 */
const INVENTORY_QR_PREFIX = 'SHEBER-INV:';

export function buildInventoryQrValue(id: string): string {
  return `${INVENTORY_QR_PREFIX}${id}`;
}

export function parseInventoryQrValue(raw: string): string | null {
  if (!raw.startsWith(INVENTORY_QR_PREFIX)) return null;
  const id = raw.slice(INVENTORY_QR_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
