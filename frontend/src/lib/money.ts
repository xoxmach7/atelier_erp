/**
 * Денежная сумма для показа пользователю.
 *
 * Принимает число или Decimal-строку бэкенда («35000.00»).
 *
 * Существует отдельно от разбивки цифр из поля ввода намеренно: раньше эти
 * две задачи решались одной функцией, которая вырезала все нецифровые символы
 * — вместе с десятичной точкой. Платёж «35000.00» показывался как
 * «3 500 000», то есть в сто раз больше внесённого.
 */
export function fmtMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "0";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return "0";
  return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
}

/** Разбивка на разряды для сырой строки цифр из поля ввода. */
export function fmtDigits(v: string): string {
  return v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
