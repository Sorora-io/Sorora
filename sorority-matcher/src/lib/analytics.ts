import mixpanel from 'mixpanel-browser';

export type Consent = 'accepted' | 'declined' | null;
export const CONSENT_KEY = 'sorora.analytics-consent.v1';
export const CONSENT_EVENT = 'sorora:analytics-consent';
const events = ['sign_up_completed', 'login_completed', 'ranking_submitted', 'matching_completed', 'pairings_updated', 'reveal_requested', 'reveal_scheduled', 'reveal_cancelled', 'page_viewed'] as const;
type AnalyticsEvent = typeof events[number];
let initialized = false;
let storageFailed = false;
let lastPage: string | null = null;

export function getConsent(): Consent {
  if (storageFailed) return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch { return null; }
}

// Allowlist SDK defaults too: no URLs, referrers, account IDs or profile data.
const allowedProperties = new Set(['token', 'distinct_id', '$device_id', '$insert_id', 'time', 'mp_lib', '$lib_version', 'platform', 'page']);
export function sanitizeEvent(payload: { event: string; properties: Record<string, unknown> }) {
  if (getConsent() !== 'accepted' || !(events as readonly string[]).includes(payload.event)) return null;
  return { ...payload, properties: Object.fromEntries(Object.entries(payload.properties).filter(([key]) => allowedProperties.has(key))) };
}
export function initializeAnalytics() {
  if (getConsent() !== 'accepted') return false;
  const token = process.env.REACT_APP_MIXPANEL_TOKEN;
  if (!token) return false;
  try {
    if (!initialized) {
      // SDK runtime supports track_marketing; its bundled types omit it.
      const config = {
        autocapture: false, track_pageview: false, record_sessions_percent: 0,
        record_heatmap_data: false, track_marketing: false, save_referrer: false,
        ip: false, persistence: 'localStorage' as const, batch_requests: false,
        hooks: { before_send_events: sanitizeEvent },
      };
      mixpanel.init(token, config);
      initialized = true;
      // A fresh anonymous journey on each app load; never identify a Sorora account.
      mixpanel.reset();
    }
    if (mixpanel.has_opted_out_tracking()) {
      mixpanel.opt_in_tracking({ track: () => {} });
      mixpanel.reset();
    }
    return true;
  } catch { return false; }
}
export function resetAnalyticsSession() {
  if (!initialized || getConsent() !== 'accepted') return;
  try { mixpanel.reset(); } catch { /* Analytics must not interrupt auth. */ }
  lastPage = null;
}
export function setConsent(choice: Exclude<Consent, null>): boolean {
  try { window.localStorage.setItem(CONSENT_KEY, choice); }
  catch {
    storageFailed = true;
    syncConsent();
    window.dispatchEvent(new Event(CONSENT_EVENT));
    return false;
  }
  storageFailed = false;
  syncConsent();
  window.dispatchEvent(new Event(CONSENT_EVENT));
  return true;
}
export function syncConsent() {
  if (getConsent() === 'accepted' || !initialized) return;
  // clear_persistence defaults to true in the SDK. No profile deletion request.
  try { mixpanel.opt_out_tracking({ delete_user: false }); }
  catch { /* Every track also checks consent. */ }
  lastPage = null;
}
export function trackEvent(event: AnalyticsEvent) {
  if (!initialized || getConsent() !== 'accepted') return;
  try { mixpanel.track(event, { platform: 'web' }); } catch { /* Best effort only. */ }
}
const pages = new Set(['/', '/login', '/reset-password', '/superuser', '/profile', '/dashboard', '/about', '/faq', '/contact', '/group/onboarding', '/group/pending', '/group/approvals', '/group/settings', '/group/status', '/group/pairings', '/group/submit-ranking', '/group/roster']);
export function safePage(pathname: string) {
  const path = pathname.split(/[?#]/)[0];
  if (pages.has(path)) return path;
  if (/^\/group\/roster\/[^/]+$/.test(path)) return '/group/roster/:memberId';
  if (/^\/superuser\/organizations\/[^/]+\/settings$/.test(path)) return '/superuser/organizations/:groupId/settings';
  return 'not_found';
}
export function trackPage(pathname: string) {
  if (!initialized || getConsent() !== 'accepted') return;
  const page = safePage(pathname);
  if (lastPage === page) return;
  try { mixpanel.track('page_viewed', { platform: 'web', page }); lastPage = page; } catch { /* Best effort only. */ }
}
