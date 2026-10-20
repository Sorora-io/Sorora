import { render } from '@testing-library/react';
import AnalyticsIdentity from './AnalyticsIdentity';

const mockMixpanel = {
  init: jest.fn(), track: jest.fn(), reset: jest.fn(), identify: jest.fn(), peopleSet: jest.fn(),
  optIn: jest.fn(), optOut: jest.fn(),
};
jest.mock('mixpanel-browser', () => ({__esModule:true,default:{
  init:(...a:any[])=>mockMixpanel.init(...a), track:(...a:any[])=>mockMixpanel.track(...a),
  reset:(...a:any[])=>mockMixpanel.reset(...a), identify:(...a:any[])=>mockMixpanel.identify(...a),
  people:{set:(...a:any[])=>mockMixpanel.peopleSet(...a)},
  has_opted_out_tracking:()=>false, opt_in_tracking:(...a:any[])=>mockMixpanel.optIn(...a), opt_out_tracking:(...a:any[])=>mockMixpanel.optOut(...a),
}}));

const mockAuthState: { current: any } = { current: { user: null, loading: false } };
const mockGroupState: { current: any } = { current: { membership: null } };
const mockProfileState: { current: any } = { current: { data: undefined } };
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuthState.current }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => mockGroupState.current }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => mockProfileState.current }));

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  process.env.REACT_APP_MIXPANEL_TOKEN = 'test-token';
  mockAuthState.current = { user: null, loading: false };
  mockGroupState.current = { membership: null };
  mockProfileState.current = { data: undefined };
});
afterEach(() => { delete process.env.REACT_APP_MIXPANEL_TOKEN; });

test('restored session identifies the user with their Supabase UUID and sets People properties from profile and membership', () => {
  mockAuthState.current = { user: { id: 'uuid-123', email: 'alex@example.com', user_metadata: { name: 'Fallback Name' } }, loading: false };
  mockGroupState.current = { membership: { role: 'big', is_admin: false, group: { name: 'Alpha Phi' } } };
  mockProfileState.current = { data: { name: 'Alex Rivera' } };
  render(<AnalyticsIdentity />);
  expect(mockMixpanel.identify).toHaveBeenCalledWith('uuid-123');
  expect(mockMixpanel.peopleSet).toHaveBeenCalledWith({$name:'Alex Rivera',$email:'alex@example.com',role:'big',chapter:'Alpha Phi',is_admin:false});
});
test('an unauthenticated session resets analytics without identifying anyone', () => {
  render(<AnalyticsIdentity />);
  expect(mockMixpanel.identify).not.toHaveBeenCalled();
  expect(mockMixpanel.peopleSet).not.toHaveBeenCalled();
  expect(mockMixpanel.reset).toHaveBeenCalled();
});
test('a user with no profile row yet falls back to Supabase auth metadata name and skips chapter when they have none', () => {
  mockAuthState.current = { user: { id: 'uuid-456', email: 'sam@example.com', user_metadata: { name: 'Sam Patel' } }, loading: false };
  render(<AnalyticsIdentity />);
  expect(mockMixpanel.identify).toHaveBeenCalledWith('uuid-456');
  expect(mockMixpanel.peopleSet).toHaveBeenCalledWith({$name:'Sam Patel',$email:'sam@example.com'});
});
test('legacy preference values do not prevent configured identity tracking', () => {
  localStorage.setItem('sorora.analytics-consent.v1', 'declined');
  mockAuthState.current = { user: { id: 'uuid-789', email: 'jo@example.com', user_metadata: {} }, loading: false };
  mockGroupState.current = { membership: { role: 'admin', is_admin: true, group: { name: 'Beta Chi' } } };
  mockProfileState.current = { data: { name: 'Jo' } };
  render(<AnalyticsIdentity />);
  expect(mockMixpanel.identify).toHaveBeenCalledWith('uuid-789');
  expect(mockMixpanel.peopleSet).toHaveBeenCalledWith({$name:'Jo',$email:'jo@example.com',role:'admin',chapter:'Beta Chi',is_admin:true});
});
