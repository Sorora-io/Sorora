import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import AnalyticsPageviews from './AnalyticsPageviews';
const mockTrack = jest.fn(); const mockInit = jest.fn();
jest.mock('../contexts/AuthContext', () => ({useAuth:()=>({loading:false})}));
jest.mock('mixpanel-browser', () => ({__esModule:true,default:{init:(...args:any[])=>mockInit(...args),track:(...args:any[])=>mockTrack(...args),reset:jest.fn(),has_opted_out_tracking:()=>false}}));
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); process.env.REACT_APP_MIXPANEL_TOKEN='test-token'; });
afterEach(() => {delete process.env.REACT_APP_MIXPANEL_TOKEN;});
test('tracks page visits without rendering any preferences controls', () => {
 render(<StrictMode><MemoryRouter><AnalyticsPageviews /><Link to="/about">About page</Link></MemoryRouter></StrictMode>);
 expect(screen.queryByText('Analytics preferences')).not.toBeInTheDocument();
 expect(mockInit).toHaveBeenCalledTimes(1);
 expect(mockTrack).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByText('About page'));
 expect(mockTrack).toHaveBeenCalledTimes(2);
});
