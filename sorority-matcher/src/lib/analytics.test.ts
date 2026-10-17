const mockMixpanel = {
  init: jest.fn(), track: jest.fn(), reset: jest.fn(),
  has_opted_out_tracking: jest.fn(() => false), opt_in_tracking: jest.fn(), opt_out_tracking: jest.fn(),
};
jest.mock('mixpanel-browser', () => ({ __esModule: true, default: mockMixpanel }));
let analytics: typeof import('./analytics');
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks(); localStorage.clear();
  process.env.REACT_APP_MIXPANEL_TOKEN = 'test-token';
  analytics = require('./analytics');
});
afterEach(() => { jest.restoreAllMocks(); delete process.env.REACT_APP_MIXPANEL_TOKEN; });
const accept = () => { analytics.setConsent('accepted'); analytics.initializeAnalytics(); };
test('no initialization, identifiers or queued events before consent, or after decline', () => {
  analytics.initializeAnalytics(); analytics.trackEvent('ranking_submitted'); analytics.trackPage('/');
  analytics.setConsent('declined'); analytics.initializeAnalytics();
  expect(mockMixpanel.init).not.toHaveBeenCalled(); expect(mockMixpanel.track).not.toHaveBeenCalled();
  accept(); expect(mockMixpanel.track).not.toHaveBeenCalled();
});
test('initializes once and deduplicates StrictMode page effects while tracking navigation', () => {
  accept(); analytics.initializeAnalytics(); analytics.trackPage('/login?email=private#token');
  analytics.trackPage('/login'); analytics.trackPage('/dashboard'); analytics.trackPage('/login');
  expect(mockMixpanel.init).toHaveBeenCalledTimes(1);
  expect(mockMixpanel.track.mock.calls).toEqual([
    ['page_viewed', {platform:'web',page:'/login'}],
    ['page_viewed', {platform:'web',page:'/dashboard'}],
    ['page_viewed', {platform:'web',page:'/login'}],
  ]);
});
test('withdrawal clears SDK persistence and prevents events, including across tabs', () => {
  accept(); analytics.setConsent('declined'); analytics.trackEvent('login_completed');
  expect(mockMixpanel.opt_out_tracking).toHaveBeenCalledWith({delete_user:false});
  expect(mockMixpanel.track).not.toHaveBeenCalled();
  accept(); localStorage.removeItem(analytics.CONSENT_KEY); analytics.syncConsent();
  analytics.trackPage('/'); expect(mockMixpanel.track).not.toHaveBeenCalled();
});
test('allowlist strips sensitive SDK defaults and arbitrary properties', () => {
  accept();
  expect(analytics.sanitizeEvent({event:'ranking_submitted',properties:{token:'test-token',distinct_id:'random',platform:'web',email:'private',name:'private',rankings:['private'], '$user_id':'account', '$current_url':'private', '$referrer':'private',utm_source:'private'}})).toEqual({event:'ranking_submitted',properties:{token:'test-token',distinct_id:'random',platform:'web'}});
  expect(analytics.sanitizeEvent({event:'$identify',properties:{}})).toBeNull();
  expect(analytics.safePage('/superuser/organizations/private/settings')).toBe('/superuser/organizations/:groupId/settings');
  expect(analytics.safePage('/group/roster/private-member')).toBe('/group/roster/:memberId');
  expect(analytics.safePage('/private-email')).toBe('not_found');
});
test('storage failure fails closed, including failure to save withdrawal', () => {
  accept(); jest.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw Error('blocked');});
  expect(analytics.setConsent('declined')).toBe(false); analytics.trackEvent('matching_completed');
  expect(analytics.getConsent()).toBeNull(); expect(mockMixpanel.track).not.toHaveBeenCalled();
});
test('SDK errors never interrupt user actions and session reset passes no account ID', () => {
  accept(); mockMixpanel.track.mockImplementationOnce(() => {throw Error('blocked');});
  expect(() => analytics.trackEvent('login_completed')).not.toThrow();
  analytics.resetAnalyticsSession(); expect(mockMixpanel.reset).toHaveBeenLastCalledWith();
});
test('development without an explicit test token stays silent', () => {
  delete process.env.REACT_APP_MIXPANEL_TOKEN; analytics.setConsent('accepted');
  expect(analytics.initializeAnalytics()).toBe(false); expect(mockMixpanel.init).not.toHaveBeenCalled();
});

export {};
