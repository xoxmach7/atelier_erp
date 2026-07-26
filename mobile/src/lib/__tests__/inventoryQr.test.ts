import { buildInventoryQrValue, parseInventoryQrValue } from '../inventoryQr';

describe('buildInventoryQrValue', () => {
  it('формирует строку с префиксом', () => {
    expect(buildInventoryQrValue('abc-123')).toBe('SHEBER-INV:abc-123');
  });
});

describe('parseInventoryQrValue', () => {
  it('извлекает id из валидной строки', () => {
    expect(parseInventoryQrValue('SHEBER-INV:abc-123')).toBe('abc-123');
  });

  it('возвращает null для чужого QR (нет префикса)', () => {
    expect(parseInventoryQrValue('https://example.com')).toBeNull();
  });

  it('возвращает null, если после префикса пусто', () => {
    expect(parseInventoryQrValue('SHEBER-INV:')).toBeNull();
  });

  it('обрезает пробелы вокруг id', () => {
    expect(parseInventoryQrValue('SHEBER-INV: abc-123 ')).toBe('abc-123');
  });
});
