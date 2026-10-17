import { useEffect, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';

interface DeadlineFields {
  ranking_deadline?: string | null;
  ranking_deadline_at?: string | null;
  ranking_deadline_timezone?: string | null;
}

// Preserve legacy date-only deadlines through midnight at the end of that UTC day.
export const deadlineInstant = (deadline?: string | null) => !deadline ? null
  : /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? new Date(Date.parse(`${deadline}T00:00:00Z`) + 86_400_000).toISOString()
    : deadline;
export const groupRankingDeadline = (group?: DeadlineFields | null) =>
  group?.ranking_deadline_at ?? group?.ranking_deadline ?? null;
export const rankingDeadlinePassed = (deadline?: string | null, now = Date.now()) =>
  !!deadline && now >= Date.parse(deadlineInstant(deadline)!);

export const deadlineInput = (deadline?: string | null, timeZone = 'UTC') => {
  const instant = deadlineInstant(deadline);
  return instant ? Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDateTime().toString({ smallestUnit: 'minute' }) : '';
};

export function parseDeadlineInput(local: string, timeZone: string): { instant: string | null; error: string | null } {
  if (!local) return { instant: null, error: null };
  if (!timeZone) return { instant: null, error: 'Choose a time zone for the ranking deadline.' };
  try {
    // Fixed numeric offsets cannot express a chapter's future daylight-saving rules.
    if (timeZone !== 'UTC' && !timeZone.includes('/')) throw new Error('Invalid zone');
    new Intl.DateTimeFormat('en', { timeZone }).format();
    const plain = Temporal.PlainDateTime.from(local, { overflow: 'reject' });
    const earlier = plain.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
    const later = plain.toZonedDateTime(timeZone, { disambiguation: 'later' });
    if (earlier.epochMilliseconds !== later.epochMilliseconds) {
      const repeated = earlier.toPlainDateTime().equals(plain) && later.toPlainDateTime().equals(plain);
      return { instant: null, error: repeated
        ? 'This time occurs twice when daylight saving time ends. Choose a time outside the repeated hour.'
        : 'This local time does not exist because the clocks move forward. Choose another time.' };
    }
    return { instant: earlier.toInstant().toString(), error: null };
  } catch {
    return { instant: null, error: 'Enter a valid deadline date and time, and choose a valid named time zone.' };
  }
}

export function formatRankingDeadline(group?: DeadlineFields | null): string {
  const deadline = groupRankingDeadline(group);
  if (!deadline) return 'No deadline set';
  const zone = group?.ranking_deadline_timezone || 'UTC';
  const formatted = new Intl.DateTimeFormat(undefined, {
    timeZone: zone, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(deadlineInstant(deadline)!));
  return `${formatted} (${zone})`;
}

const fallbackZones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
export const deadlineTimeZones: string[] = ['UTC', ...Array.from(new Set([
  ...fallbackZones,
  ...((Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []),
])).sort()];

export function useRankingDeadline(deadline?: string | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!deadline) return;
    const remaining = Date.parse(deadlineInstant(deadline)!) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining, 86_400_000));
    return () => clearTimeout(timer);
  }, [deadline, now]);
  return rankingDeadlinePassed(deadline, now);
}
