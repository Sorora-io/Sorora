const mockMixpanel = {
  init: jest.fn(), track: jest.fn(), reset: jest.fn(), identify: jest.fn(),
  people: { set: jest.fn() },
  has_opted_out_tracking: jest.fn(() => false), opt_in_tracking: jest.fn(), opt_out_tracking: jest.fn(),
};
jest.mock('mixpanel-browser', () => ({ __esModule: true, default: mockMixpanel }));
let analytics: typeof import('./analytics');
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks(); mockMixpanel.people.set.mockClear(); localStorage.clear();
  process.env.REACT_APP_MIXPANEL_TOKEN = 'test-token';
  analytics = require('./analytics');
});
afterEach(() => { jest.restoreAllMocks(); delete process.env.REACT_APP_MIXPANEL_TOKEN; });
test('declining prevents initialization and all events, and a previously declined browser stays silent', () => {
  analytics.setConsent('declined'); analytics.initializeAnalytics();
  analytics.trackEvent('ranking_submitted'); analytics.trackPage('/');
  expect(mockMixpanel.init).not.toHaveBeenCalled(); expect(mockMixpanel.track).not.toHaveBeenCalled();
});
test('a first-time browser initializes without a stored choice and tracks pages', () => {
  expect(analytics.getConsent()).toBeNull();
  analytics.initializeAnalytics(); analytics.trackPage('/login?email=private#token');
  analytics.trackPage('/login'); analytics.trackPage('/dashboard'); analytics.trackPage('/login');
  expect(mockMixpanel.init).toHaveBeenCalledTimes(1);
  expect(mockMixpanel.track.mock.calls).toEqual([
    ['page_viewed', {platform:'web',page:'/login'}],
    ['page_viewed', {platform:'web',page:'/dashboard'}],
    ['page_viewed', {platform:'web',page:'/login'}],
  ]);
});
test('withdrawal clears SDK persistence and prevents events, and re-opting-in resumes tracking', () => {
  analytics.initializeAnalytics(); analytics.setConsent('declined');
  analytics.trackEvent('login_completed');
  expect(mockMixpanel.opt_out_tracking).toHaveBeenCalledWith({delete_user:false});
  expect(mockMixpanel.track).not.toHaveBeenCalled();
  analytics.setConsent('accepted'); analytics.initializeAnalytics(); analytics.trackPage('/');
  expect(mockMixpanel.track).toHaveBeenCalledWith('page_viewed', {platform:'web',page:'/'});
});
test('allowlist strips sensitive SDK defaults and arbitrary properties', () => {
  analytics.initializeAnalytics();
  expect(analytics.sanitizeEvent({event:'ranking_submitted',properties:{token:'test-token',distinct_id:'random',platform:'web',email:'private',name:'private',rankings:['private'], '$user_id':'account', '$current_url':'private', '$referrer':'private',utm_source:'private'}})).toEqual({event:'ranking_submitted',properties:{token:'test-token',distinct_id:'random',platform:'web'}});
  expect(analytics.sanitizeEvent({event:'$identify',properties:{}})).toBeNull();
  expect(analytics.safePage('/superuser/organizations/private/settings')).toBe('/superuser/organizations/:groupId/settings');
  expect(analytics.safePage('/group/roster/private-member')).toBe('/group/roster/:memberId');
  expect(analytics.safePage('/private-email')).toBe('not_found');
});
test('storage failure fails closed, including failure to save withdrawal', () => {
  analytics.initializeAnalytics(); jest.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw Error('blocked');});
  expect(analytics.setConsent('declined')).toBe(false); analytics.trackEvent('matching_completed');
  expect(analytics.getConsent()).toBeNull(); expect(mockMixpanel.track).not.toHaveBeenCalled();
});
test('SDK errors never interrupt user actions and session reset passes no account ID', () => {
  analytics.initializeAnalytics(); mockMixpanel.track.mockImplementationOnce(() => {throw Error('blocked');});
  expect(() => analytics.trackEvent('login_completed')).not.toThrow();
  analytics.resetAnalyticsSession(); expect(mockMixpanel.reset).toHaveBeenLastCalledWith();
});
test('development without an explicit test token stays silent', () => {
  delete process.env.REACT_APP_MIXPANEL_TOKEN;
  expect(analytics.initializeAnalytics()).toBe(false); expect(mockMixpanel.init).not.toHaveBeenCalled();
});
test('identify runs once per user and sends only allowed People properties', () => {
  analytics.initializeAnalytics();
  analytics.identifyUser('user-abc'); analytics.identifyUser('user-abc'); // dedupes
  expect(mockMixpanel.identify.mock.calls).toEqual([['user-abc']]);
  analytics.setUserProperties({name:' Alex Rivera ',email:'alex@example.com',role:'big',is_admin:true,chapter:'Alpha Phi'});
  analytics.setUserProperties({name:'Alex Rivera',email:'alex@example.com',role:'big',is_admin:true,chapter:'Alpha Phi'}); // dedupes trimmed
  expect(mockMixpanel.people.set.mock.calls).toEqual([[{$name:'Alex Rivera',$email:'alex@example.com',role:'big',chapter:'Alpha Phi',is_admin:true}]]);
});
test('setUserProperties drops unknown and empty fields and refuses to run without an identified user', () => {
  analytics.initializeAnalytics();
  analytics.setUserProperties({name:'nope'} as any); // no identified user yet
  analytics.identifyUser('user-abc');
  analytics.setUserProperties({name:'Alex',email:'',role:undefined,chapter:'  ',ssn:'private'} as any);
  expect(mockMixpanel.people.set).toHaveBeenCalledTimes(1);
  expect(mockMixpanel.people.set.mock.calls[0][0]).toEqual({$name:'Alex'});
});
test('sign-out and account-switch reset distinct_id and require fresh identify next time', () => {
  analytics.initializeAnalytics(); analytics.identifyUser('user-a');
  analytics.resetAnalyticsSession();
  expect(mockMixpanel.reset).toHaveBeenCalled();
  analytics.identifyUser('user-a'); analytics.identifyUser('user-b');
  expect(mockMixpanel.identify.mock.calls).toEqual([['user-a'],['user-a'],['user-b']]);
});
test('withdrawn consent blocks identify, people.set, and clears stored identity so a later opt-in re-identifies', () => {
  analytics.initializeAnalytics(); analytics.identifyUser('user-a'); analytics.setConsent('declined');
  analytics.identifyUser('user-b'); analytics.setUserProperties({name:'Alex'});
  expect(mockMixpanel.identify).toHaveBeenCalledTimes(1); // only pre-decline
  expect(mockMixpanel.people.set).not.toHaveBeenCalled();
  analytics.setConsent('accepted'); analytics.initializeAnalytics(); analytics.identifyUser('user-a');
  expect(mockMixpanel.identify.mock.calls).toEqual([['user-a'],['user-a']]);
});

export {};
