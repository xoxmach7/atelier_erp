import { previewMeters } from '../MeasurementForm';

// Живое превью метража в форме замера должно совпадать с серверной формулой
// (services.measurement_calc): ceil_0.1(ширина × сборка / 100).
describe('previewMeters', () => {
  it('считает метраж по ширине и коэффициенту сборки', () => {
    expect(previewMeters('300', '2.2')).toBe('6.6');
    expect(previewMeters('300', '2.0')).toBe('6.0');
  });

  it('округляет вверх до 0.1 м', () => {
    // 305 × 2.2 / 100 = 6.71 → 6.8
    expect(previewMeters('305', '2.2')).toBe('6.8');
  });

  it('возвращает пусто при незаполненной ширине или сборке', () => {
    expect(previewMeters('', '2.2')).toBe('');
    expect(previewMeters('300', '')).toBe('');
    expect(previewMeters('abc', '2.2')).toBe('');
  });
});
