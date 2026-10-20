import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { isEffectiveAdmin } from '../lib/groups';
import { hasTourSeen, markTourSeen } from '../lib/tour';
import Button from './Button';

export const WELCOME_TOUR_KEY = 'workspace-walkthrough-v2';
type Step = { path: string; title: string; body: string; target?: string };

export default function WelcomeTour() {
  const { user } = useAuth();
  const { membership } = useGroup();
  const location = useLocation();
  const navigate = useNavigate();
  const [index, setIndex] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const identity = user && membership ? `${WELCOME_TOUR_KEY}:${user.id}:${membership.id}` : null;
  const admin = !!membership && isEffectiveAdmin(membership);
  const steps = useMemo<Step[]>(() => [
    { path: '/dashboard', title: 'Your chapter at a glance', body: 'Your overview shows ranking status, deadlines, and the next action to take.', target: 'dashboard' },
    { path: '/dashboard?tab=rankings', title: 'Your rankings', body: 'Start or edit your list here. In the editor, reorder members and choose Submit rankings to send your preferences. You can resubmit while rankings are open.', target: 'rankings' },
    { path: '/group/submit-ranking', title: 'Put your preferences in order', body: 'Add members, reorder your choices, and use Submit rankings when you are ready. Unsaved changes are clearly marked; this tour does not submit anything.', target: 'ranking-submit' },
    { path: '/dashboard?tab=roster', title: 'Meet your chapter', body: 'Search the full roster, filter by role, and open a member’s profile to learn more.', target: 'roster' },
    ...(admin ? [
      { path: '/dashboard?tab=organization', title: 'Manage the matching cycle', body: 'Review membership requests and submission progress. Run matching when your chapter is ready; results remain available for admin review.', target: 'organization' },
      { path: '/group/status', title: 'Check submissions before matching', body: 'See who has submitted and who is still waiting. Run matching starts the algorithm; simply viewing this page does not run it.', target: 'run-matching' },
      { path: '/group/pairings', title: 'Review your chapter’s pairings', body: 'Review unmatched members and pairings grouped by family size. Confirm each pairing or make a thoughtful adjustment before planning your reveal.', target: 'pairing-results' },
      { path: '/dashboard?tab=settings', title: 'Set your chapter’s rules', body: 'Manage cycle dates, ranking privacy, and matching settings here. This tour does not change them.', target: 'settings' },
    ] : []),
    { path: '/profile', title: 'Your profile and account', body: 'Add your photo and profile details here. Account settings include your password and sign-out controls.' },
    { path: '/faq', title: 'Help when you need it', body: 'Find answers here. The footer also links to About, Contact us, and Replay the tour.' },
  ], [admin]);

  useEffect(() => { setIndex(null); }, [identity, admin]);
  useEffect(() => {
    if (!identity || membership?.status !== 'approved' || location.pathname !== '/dashboard') return;
    const replay = new URLSearchParams(location.search).get('tour') === '1';
    if (index === null && (replay || !hasTourSeen(identity))) {
      setIndex(0);
      navigate('/dashboard', { replace: true });
    }
  }, [identity, membership?.status, location.pathname, location.search, index, navigate]);

  useEffect(() => {
    if (index === null || !steps[index]) return;
    heading.current?.focus();
    let target: Element | null = null;
    document.body.classList.add('ss-touring');
    const highlight = () => {
      target = document.querySelector(`[data-tour="${steps[index].target || ''}"]`);
      if (!target) return false;
      target.classList.add('ss-tour-highlight');
      target.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
      return true;
    };
    // Lazy routes may still be loading when the tour step changes.
    const observer = new MutationObserver(() => { if (highlight()) observer.disconnect(); });
    if (!highlight() && steps[index].target) observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); target?.classList.remove('ss-tour-highlight'); document.body.classList.remove('ss-touring'); };
  }, [index, steps, location.pathname, location.search]);

  if (index === null || !steps[index] || !identity || membership?.status !== 'approved') return null;
  const finish = () => { markTourSeen(identity); setIndex(null); navigate('/dashboard'); };
  const go = (next: number) => { setIndex(next); navigate(steps[next].path); window.scrollTo({ top: 0, behavior: 'auto' }); };
  return <aside className="ss-guided-tour" aria-label="Site walkthrough" onKeyDown={event => { if (event.key === 'Escape') finish(); }}>
    <div className="flex items-center justify-between gap-3"><p className="ss-caption">Site tour · {index + 1} of {steps.length}</p>
      <Button variant="ghost" size="sm" onClick={finish}>Skip tour</Button></div>
    <h2 ref={heading} tabIndex={-1} className="mt-2 text-xl font-semibold">{steps[index].title}</h2>
    <p className="mt-2 text-sm leading-relaxed">{steps[index].body}</p>
    <div className="mt-4 flex justify-between gap-3">
      <Button variant="outline" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>Back</Button>
      <Button size="sm" onClick={() => index === steps.length - 1 ? finish() : go(index + 1)}>{index === steps.length - 1 ? 'Finish tour' : 'Next page'}</Button>
    </div>
  </aside>;
}
