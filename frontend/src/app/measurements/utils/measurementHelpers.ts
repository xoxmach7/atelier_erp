/**
 * Measurement Helpers - ID generation and calculations
 */

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateProjectId(): string {
  return `meas-${Date.now()}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("ru-RU");
}

export function formatDimensions(width: number, height: number): string {
  return `${width}×${height} см`;
}

export function getMountingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ceiling: "Потолок",
    wall: "Стена",
    niche: "Ниша",
    window_recess: "Проём",
    "": "Не указан",
  };
  return labels[type] || type;
}

export function getCorniceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    standard: "Обычный",
    hidden: "Скрытый",
    electric: "Электро",
    none: "Без карниза",
    "": "Не указан",
  };
  return labels[type] || type;
}

export function getComplexityLabel(complexity: string): string {
  const labels: Record<string, string> = {
    standard: "Стандартная",
    complex: "Сложная",
    very_complex: "Очень сложная",
  };
  return labels[complexity] || complexity;
}
