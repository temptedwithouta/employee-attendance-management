import { z } from 'zod';

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export function formatAttendanceTimestamp(value: string): string {
  if (!isoDateTimeSchema.safeParse(value).success) return 'Timestamp unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Timestamp unavailable';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
