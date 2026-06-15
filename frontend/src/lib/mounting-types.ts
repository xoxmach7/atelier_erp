/**
 * Типы оконных систем / крепления для замеров и изделий.
 * Единый источник истины: используется в формах создания/редактирования замера
 * и при отображении. Значение (value) хранится в БД (Measurement.mounting_type),
 * label — то, что видит пользователь.
 */

export interface MountingOption {
  value: string;
  label: string;
}

export const MOUNTING_OPTIONS: MountingOption[] = [
  { value: "cornice", label: "Карниз" },
  { value: "electric_cornice", label: "Электрокарниз" },
  { value: "roller", label: "Рулонная штора (ролл-штора)" },
  { value: "roman", label: "Римская штора" },
  { value: "japanese", label: "Японские панели" },
  { value: "pleated", label: "Плиссе" },
  { value: "blinds", label: "Жалюзи" },
  { value: "day_night", label: "День-ночь (зебра)" },
];

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  MOUNTING_OPTIONS.map((o) => [o.value, o.label])
);

/** Подпись типа крепления. Для старых/неизвестных значений возвращает само значение. */
export function getMountingTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABEL_BY_VALUE[value] ?? value;
}
