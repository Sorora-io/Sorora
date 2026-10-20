import mixpanel from 'mixpanel-browser';

const events = ['sign_up_completed', 'login_completed', 'ranking_submitted', 'matching_completed', 'pairings_updated', 'reveal_requested', 'reveal_scheduled', 'reveal_cancelled', 'page_viewed'] as const;
type AnalyticsEvent = typeof events[number];
let initialized = false;
let lastPage: string | null = null;
let identifiedUserId: string | null = null;
let lastPropertiesKey = '';
// Only these People profile properties ever leave the browser; everything else is dropped.
const allowedUserProperties = ['$name', '$email', 'role', 'is_admin', 'chapter'] as const;
export type UserProperties = { name?: string | null; email?: string | null; role?: string | null; is_admin?: boolean | null; chapter?: string | null };

// Analytics are enabled by the product configuration, with no preferences control.
export function isAnalyticsEnabled(): boolean { return true; }

// Allowlist SDK defaults too: no URLs, referrers, account IDs or profile data.
const allowedProperties = new Set(['token', 'distinct_id', '$device_id', '$insert_id', 'time', 'mp_lib', '$lib_version', 'platform', 'page']);
export function sanitizeEvent(payload: { event: string; properties: Record<string, unknown> }) {
  if (!isAnalyticsEnabled() || !(events as readonly string[]).includes(payload.event)) return null;
  return { ...payload, properties: Object.fromEntries(Object.entries(payload.properties).filter(([key]) => allowedProperties.has(key))) };
}
export function initializeAnalytics() {
  if (!isAnalyticsEnabled()) return false;
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
      // Start anonymous; AnalyticsIdentity identifies authenticated accounts afterward.
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
  identifiedUserId = null; lastPropertiesKey = '';
  if (!initialized || !isAnalyticsEnabled()) return;
  try { mixpanel.reset(); } catch { /* Analytics must not interrupt auth. */ }
  lastPage = null;
}
export function identifyUser(userId: string) {
  if (!initialized || !isAnalyticsEnabled() || identifiedUserId === userId) return;
  try { mixpanel.identify(userId); identifiedUserId = userId; lastPropertiesKey = ''; }
  catch { /* Analytics must not interrupt auth. */ }
}
export function setUserProperties(props: UserProperties) {
  if (!initialized || !isAnalyticsEnabled() || !identifiedUserId) return;
  const payload: Record<string, string | boolean> = {};
  const trim = (value: string | null | undefined) => (value ?? '').trim();
  const name = trim(props.name); if (name) payload['$name'] = name;
  const email = trim(props.email); if (email) payload['$email'] = email;
  const role = trim(props.role); if (role) payload['role'] = role;
  const chapter = trim(props.chapter); if (chapter) payload['chapter'] = chapter;
  if (typeof props.is_admin === 'boolean') payload['is_admin'] = props.is_admin;
  // People.set bypasses the sanitize hook; the allowlist above is the only filter.
  for (const key of Object.keys(payload)) {
    if (!(allowedUserProperties as readonly string[]).includes(key)) delete payload[key];
  }
  const key = JSON.stringify(payload);
  if (key === lastPropertiesKey || key === '{}') return;
  lastPropertiesKey = key;
  try { mixpanel.people.set(payload); } catch { /* Analytics must not interrupt auth. */ }
}
export function trackEvent(event: AnalyticsEvent) {
  if (!initialized || !isAnalyticsEnabled()) return;
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
  if (!initialized || !isAnalyticsEnabled()) return;
  const page = safePage(pathname);
  if (lastPage === page) return;
  try { mixpanel.track('page_viewed', { platform: 'web', page }); lastPage = page; } catch { /* Best effort only. */ }
}
