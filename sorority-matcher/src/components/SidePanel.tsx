import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, LogOut, Check, BookOpen, HelpCircle, Compass, LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { useMatching } from '../contexts/MatchingContext';
import { isEffectiveAdmin, Membership } from '../lib/groups';

interface NavItem {
  label: string;
  path: string;
}

interface NavItemWithIcon extends NavItem {
  icon: LucideIcon;
}

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const membershipLabel = (m: Membership) =>
  roleLabel[m.role] + (m.is_admin && m.role !== 'admin' ? ' + Admin' : '');

const ADMIN_GROUP_LINKS: NavItem[] = [
  { label: 'Approvals', path: '/group/approvals' },
  { label: 'Submission Status', path: '/group/status' },
  { label: 'Group Settings', path: '/group/settings' },
  { label: 'Pairings', path: '/group/pairings' },
];

const ACCOUNT_LINKS: NavItemWithIcon[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Profile', path: '/profile', icon: User },
];

const SITE_LINKS: NavItemWithIcon[] = [
  { label: 'How It Works', path: '/about', icon: BookOpen },
  { label: 'FAQ', path: '/faq', icon: HelpCircle },
];

const SidePanel = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutConfirming, setSignOutConfirming] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { membership, memberships, setActiveGroupId } = useGroup();
  const { bigs, littles, bigRankings, littleRankings, pairings } = useMatching();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const closeMobile = () => { setMobileOpen(false); setSignOutConfirming(false); };

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
    closeMobile();
  };

  const switchTo = (groupId: string) => {
    setActiveGroupId(groupId);
    setMenuOpen(false);
  };

  const otherMemberships = memberships.filter(m => m.group_id !== membership?.group_id);

  const hasBigs = bigs.length > 0;
  const hasLittles = littles.length > 0;
  const bigRankingsDone = hasBigs && Object.keys(bigRankings).length >= bigs.length;
  const littleRankingsDone = hasLittles && Object.keys(littleRankings).length >= littles.length;

  // Each Quick Match step only becomes reachable once its prerequisite is
  // done, and only steps with an unambiguous finished state (not "twin
  // availability" or "ranking rules," which have no wrong answer) get a
  // checkmark — matching the wizard's actual data dependencies, not just a
  // fixed step count.
  const wizardSteps = [
    { label: 'Add potential Bigs', path: '/admin/enter-bigs', enabled: true, done: hasBigs },
    { label: 'Add potential Littles', path: '/admin/enter-littles', enabled: hasBigs, done: hasLittles },
    { label: 'Twin availability', path: '/admin/twins', enabled: hasLittles, done: false },
    { label: 'Set ranking rules', path: '/admin/ranking-requirements', enabled: hasLittles, done: false },
    { label: "Enter each Big's Little rankings", path: '/admin/rank-preferences', enabled: hasBigs && hasLittles, done: bigRankingsDone },
    { label: "Enter each Little's Big rankings", path: '/admin/rank-bigs', enabled: bigRankingsDone, done: littleRankingsDone },
    { label: 'Review everything', path: '/admin/review-summary', enabled: hasBigs && hasLittles, done: false },
    { label: 'Matching results', path: '/admin/pairings', enabled: pairings.length > 0, done: pairings.length > 0 },
  ];
  const wizardStarted = location.pathname.startsWith('/admin/') || hasBigs || hasLittles;

  const linkClasses = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-jade-600 text-white'
        : 'text-gray-700 hover:bg-jade-50'
    }`;

  return (
    <>
      {/* Mobile-only toggle — the desktop sidebar is always visible, so this
          (and the drawer/backdrop below) only matters below md. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 flex flex-col items-center justify-center gap-1 rounded-md bg-white border border-jade-300 shadow-sm hover:bg-gray-50"
      >
        <span className="block w-5 h-0.5 bg-black" />
        <span className="block w-5 h-0.5 bg-black" />
        <span className="block w-5 h-0.5 bg-black" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={closeMobile} />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 flex-shrink-0 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <Link to="/" onClick={closeMobile} className="text-xl font-display font-semibold text-jade-800">
            Sorora
          </Link>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close navigation"
            className="md:hidden text-gray-500 hover:text-black text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {user && !isGuest && membership && (
            <div className="relative" ref={menuRef} data-tour="sidepanel-chapter">
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 text-left bg-jade-50 border border-jade-100 rounded-md px-3 py-2 hover:bg-jade-100 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-jade-800 truncate">
                    {membership.group.name}
                  </span>
                  {membership.group.school && (
                    <span className="block text-xs text-jade-500 truncate">{membership.group.school}</span>
                  )}
                  <span className="block text-xs font-medium text-jade-600">
                    {membershipLabel(membership)}
                    {membership.status !== 'approved' && ` · ${membership.status}`}
                  </span>
                </span>
                <svg
                  width="12" height="8" viewBox="0 0 12 8" fill="none"
                  className={`flex-shrink-0 text-jade-700 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-gray-200 rounded-md shadow-sm p-1 z-10 flex flex-col gap-0.5">
                  {membership.status !== 'approved' ? (
                    <button type="button" onClick={() => goTo('/group/pending')} className={linkClasses('/group/pending')}>
                      {membership.status === 'pending' ? 'View request status' : 'View details'}
                    </button>
                  ) : (
                    <>
                      {(membership.role === 'big' || membership.role === 'little') && (
                        <>
                          <button type="button" onClick={() => goTo('/group/submit-ranking')} className={linkClasses('/group/submit-ranking')}>
                            Rank {membership.role === 'big' ? 'Littles' : 'Bigs'}
                          </button>
                          <button type="button" onClick={() => goTo('/group/notes')} className={linkClasses('/group/notes')}>
                            Notes
                          </button>
                        </>
                      )}
                      {isEffectiveAdmin(membership) &&
                        ADMIN_GROUP_LINKS.map(({ label, path }) => (
                          <button key={path} type="button" onClick={() => goTo(path)} className={linkClasses(path)}>
                            {label}
                          </button>
                        ))}
                      <button type="button" onClick={() => goTo('/group/roster')} className={linkClasses('/group/roster')}>
                        Roster
                      </button>
                    </>
                  )}

                  {otherMemberships.length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Switch chapter
                      </p>
                      {otherMemberships.map(m => (
                        <button
                          key={m.group_id}
                          type="button"
                          onClick={() => switchTo(m.group_id)}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-jade-50 transition-colors"
                        >
                          <span className="block font-medium truncate">{m.group.name}</span>
                          {m.group.school && (
                            <span className="block text-xs text-gray-400 truncate">{m.group.school}</span>
                          )}
                          <span className="block text-xs text-gray-500">
                            {membershipLabel(m)}
                            {m.status !== 'approved' && ` · ${m.status}`}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {user && !isGuest && (
            <div className={membership ? 'pt-2 border-t border-gray-200' : ''} data-tour="sidepanel-account">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Account
              </p>
              <div className="flex flex-col gap-1">
                {ACCOUNT_LINKS.map(({ label, path, icon: Icon }) => (
                  <Link key={path} to={path} onClick={closeMobile} className={linkClasses(path)}>
                    <Icon size={15} /> {label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div
            className={user ? 'pt-2 border-t border-gray-200' : ''}
            data-tour="sidepanel-explore"
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Explore
            </p>
            <div className="flex flex-col gap-1">
              {SITE_LINKS.map(({ label, path, icon: Icon }) => (
                <Link key={path} to={path} onClick={closeMobile} className={linkClasses(path)}>
                  <Icon size={15} /> {label}
                </Link>
              ))}
              {user && !isGuest && memberships.length > 0 && (
                <Link
                  to="/dashboard?tour=1"
                  onClick={closeMobile}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-jade-50 transition-colors"
                >
                  <Compass size={15} /> Take a tour
                </Link>
              )}
            </div>
          </div>

          {(!user || memberships.length === 0) && (
            <div className="pt-2 border-t border-gray-200">
              {wizardStarted ? (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Quick Match Setup
                  </p>
                  <div className="flex flex-col gap-1">
                    {wizardSteps.map((step, i) => {
                      const active = location.pathname === step.path;
                      if (!step.enabled) {
                        return (
                          <span
                            key={step.path}
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-300 cursor-not-allowed"
                          >
                            <span className="flex-shrink-0 w-4 text-center">{i + 1}.</span>
                            {step.label}
                          </span>
                        );
                      }
                      return (
                        <button
                          key={step.path}
                          type="button"
                          onClick={() => goTo(step.path)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                            active ? 'bg-jade-600 text-white' : 'text-gray-700 hover:bg-jade-50'
                          }`}
                        >
                          <span className="flex-shrink-0 w-4 text-center">
                            {step.done ? (
                              <Check size={14} className={active ? 'text-white' : 'text-jade-600'} />
                            ) : (
                              `${i + 1}.`
                            )}
                          </span>
                          {step.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  to="/"
                  onClick={closeMobile}
                  className="block text-center px-3 py-2 rounded-md text-sm font-medium bg-jade-600 text-white hover:bg-jade-700 transition-colors"
                >
                  Get Started
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 text-sm">
          {user ? (
            signOutConfirming ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Sign out?</span>
                <button
                  type="button"
                  onClick={() => { signOut(); closeMobile(); navigate('/login'); }}
                  className="font-medium text-brick hover:underline"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutConfirming(false)}
                  className="text-gray-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSignOutConfirming(true)}
                className="flex items-center gap-2 text-left text-gray-600 hover:text-black"
              >
                <LogOut size={15} /> Sign out
              </button>
            )
          ) : isGuest ? (
            <div className="flex flex-col gap-2">
              <p className="text-gold-700">Guest session · Saved on this device only</p>
              <Link to="/login" onClick={closeMobile} className="underline text-gray-600 hover:text-black">
                Create an account
              </Link>
            </div>
          ) : (
            <Link to="/login" onClick={closeMobile} className={linkClasses('/login')}>
              Sign In / Sign Up
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};

export default SidePanel;
