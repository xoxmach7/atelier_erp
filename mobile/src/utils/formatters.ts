export function formatCurrency(value: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const formatted = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ₸`;
}
