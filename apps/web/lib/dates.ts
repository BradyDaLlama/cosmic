export const pad2 = (n: number) => String(n).padStart(2, '0');

export const toISODate = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export function fromISODate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export const todayISO = () => toISODate(new Date());

export function addDays(iso: string, days: number): string {
    const date = fromISODate(iso);
    date.setDate(date.getDate() + days);
    return toISODate(date);
}

export const formatClock = (at: number | string | Date) =>
    new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
