/** Формат телефона → +7 (777) 777-77-77. Для нестандартных значений возвращает как есть. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  if (d.length !== 11 || d[0] !== "7") return raw;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}
