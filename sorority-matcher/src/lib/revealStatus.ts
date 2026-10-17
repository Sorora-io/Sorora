import type { RevealStatus } from './pairings';

// Older failed schedules may have no stored message; preserve a useful
// warning when a consumed schedule still has unconfirmed pairings.
export function revealDeliveryWarning(status: RevealStatus | null | undefined): string | null {
  if (!status) return null;
  return status.failureMessage || (status.completedAt && status.sent < status.total
    ? 'The scheduled reveal finished, but some emails were not confirmed as sent. No automatic retry will be made.'
    : null);
}
