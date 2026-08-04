/**
 * Formats a Date (or timestamp in ms) into a human-readable HH:MM time string.
 * @param date - A Date object or a Unix timestamp in milliseconds.
 * @returns A string like "09:05" or "14:37".
 */
export function formatTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
