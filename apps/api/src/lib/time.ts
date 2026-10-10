export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
export const addSeconds = (d: Date, secs: number) => new Date(d.getTime() + secs * 1000);
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
