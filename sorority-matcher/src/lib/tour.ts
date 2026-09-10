const TOUR_KEY_PREFIX = 'sorora-tour-seen-';

export function hasTourSeen(tourId: string): boolean {
  try {
    return localStorage.getItem(TOUR_KEY_PREFIX + tourId) === '1';
  } catch {
    // Fail open — don't force a tour on someone just because storage is
    // unavailable (private browsing, storage disabled, etc).
    return true;
  }
}

export function markTourSeen(tourId: string) {
  try {
    localStorage.setItem(TOUR_KEY_PREFIX + tourId, '1');
  } catch {
    // ignore — the tour just won't remember it was seen on this device
  }
}
