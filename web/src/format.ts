export const START_MS = Date.UTC(2027, 0, 1);
export const N_DAYS = 731; // 2027 (365) + 2028 (366)

export function hourToDate(h: number): Date {
  return new Date(START_MS + h * 3600e3);
}
export function fmtDay(day: number): string {
  return new Date(START_MS + day * 86400e3).toISOString().slice(0, 10);
}
export function fmtDateTime(h: number): string {
  return hourToDate(h).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
export function dateToDay(s: string): number {
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) ? Math.round((t - START_MS) / 86400e3) : 0;
}
export function fmtHours(h: number): string {
  if (h < 48) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1)} days`;
}
export function pct(x: number, d = 0): string {
  return `${x.toFixed(d)}%`;
}
