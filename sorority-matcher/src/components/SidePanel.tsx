import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { groupLabel } from '../lib/groups';

interface NavItem {
  label: string;
  path: string;
}

const ADMIN_GROUP_LINKS: NavItem[] = [
  { label: 'Approvals', path: '/group/approvals' },
  { label: 'Submission Status', path: '/group/status' },
  { label: 'Group Settings', path: '/group/settings' },
  { label: 'Pairings', path: '/group/pairings' },
];

const SITE_LINKS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
];

const WIZARD_LINKS: NavItem[] = [
  { label: 'Enter Bigs', path: '/admin/enter-bigs' },
  { label: 'Enter Littles', path: '/admin/enter-littles' },
  { label: 'Twins', path: '/admin/twins' },
  { label: 'Ranking Requirements', path: '/admin/ranking-requirements' },
  { label: 'Rank Preferences', path: '/admin/rank-preferences' },
  { label: 'Rank Bigs', path: '/admin/rank-bigs' },
  { label: 'Review Summary', path: '/admin/review-summary' },
  { label: 'Pairings', path: '/admin/pairings' },
];

const SidePanel = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { membership, memberships, setActiveGroupId } = useGroup();

  const close = () => setOpen(false);

  const goTo = (groupId: string, path: string) => {
    setActiveGroupId(groupId);
    navigate(path);
    close();
  };

  const approvedMemberships = memberships.filter(m => m.status === 'approved');

  const linkClasses = (path: string) =>
    `block px-3 py-2 rounded-md text-sm transition-colors ${
      location.pathname === path
        ? 'bg-jade-600 text-white'
        : 'text-gray-700 hover:bg-jade-50'
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed top-4 left-4 z-40 w-10 h-10 flex flex-col items-center justify-center gap-1 rounded-md bg-white border border-jade-300 shadow-sm hover:bg-gray-50"
      >
        <span className="block w-5 h-0.5 bg-black" />
        <span className="block w-5 h-0.5 bg-black" />
        <span className="block w-5 h-0.5 bg-black" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={close} />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <Link to="/" onClick={close} className="text-xl font-display font-semibold text-jade-800">
            Sorora
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation"
            className="text-gray-500 hover:text-black text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <nav className="p-4 flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Explore
            </p>
            <div className="flex flex-col gap-1">
              {SITE_LINKS.map(({ label, path }) => (
                <Link key={path} to={path} onClick={close} className={linkClasses(path)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Matching Wizard (No Org)
            </p>
            <div className="flex flex-col gap-1">
              {WIZARD_LINKS.map(({ label, path }) => (
                <Link key={path} to={path} onClick={close} className={linkClasses(path)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {user && !isGuest && approvedMemberships.map(m => (
            <div key={m.group_id} className="border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                <span>{groupLabel(m.group)}</span>
                {m.group_id === membership?.group_id && (
                  <span className="text-[10px] normal-case font-medium text-gray-300">Active</span>
                )}
              </p>
              <div className="flex flex-col gap-1">
                {m.role === 'admin' ? (
                  ADMIN_GROUP_LINKS.map(({ label, path }) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => goTo(m.group_id, path)}
                      className={`text-left ${linkClasses(path)}`}
                    >
                      {label}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(m.group_id, '/group/submit-ranking')}
                    className={`text-left ${linkClasses('/group/submit-ranking')}`}
                  >
                    Rank {m.role === 'big' ? 'Littles' : 'Bigs'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 mt-auto text-sm">
          {user ? (
            <div className="flex flex-col gap-2">
              <p className="text-gray-600 truncate">Signed in as {user.email}</p>
              {membership && (
                <p className="text-gray-500 text-xs">
                  {groupLabel(membership.group)} · {membership.role}
                  {membership.status !== 'approved' && ` (${membership.status})`}
                </p>
              )}
              {!isGuest && (
                <Link to="/dashboard" onClick={close} className="underline text-gray-600 hover:text-black">
                  Dashboard
                </Link>
              )}
              <Link to="/profile" onClick={close} className="underline text-gray-600 hover:text-black">
                Profile
              </Link>
              <button
                type="button"
                onClick={() => { signOut(); close(); navigate('/login'); }}
                className="text-left underline text-gray-600 hover:text-black"
              >
                Sign out
              </button>
            </div>
          ) : isGuest ? (
            <div className="flex flex-col gap-2">
              <p className="text-gold-700">Browsing as guest — data won't be saved</p>
              <Link to="/login" onClick={close} className="underline text-gray-600 hover:text-black">
                Sign in
              </Link>
            </div>
          ) : (
            <Link to="/login" onClick={close} className={linkClasses('/login')}>
              Sign In / Sign Up
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default SidePanel;
