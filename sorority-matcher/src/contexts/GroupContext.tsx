import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { MembershipWithGroup, MembershipRole, createGroup, requestToJoinGroup, getMyMembership } from '../lib/groups';

const PENDING_ACTION_KEY = 'sorora-pending-group-action';

export interface PendingGroupAction {
  mode: 'create' | 'join';
  groupName?: string; // mode: create
  groupId?: string; // mode: join
  role?: MembershipRole; // mode: join
}

export function stashPendingGroupAction(action: PendingGroupAction) {
  try {
    localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
  } catch {
    // localStorage unavailable — the Onboarding page is the fallback
  }
}

function readPendingGroupAction(): PendingGroupAction | null {
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingGroupAction() {
  try {
    localStorage.removeItem(PENDING_ACTION_KEY);
  } catch {
    // ignore
  }
}

interface GroupContextType {
  membership: MembershipWithGroup | null;
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
};

export const GroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [membership, setMembership] = useState<MembershipWithGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);

  // `loading` reflects any in-flight fetch (including a refresh() called
  // after a save, to pick up new data) — pages should feel free to ignore it
  // and keep their own content mounted. `initialized` only ever flips once,
  // from false to true, the first time membership status becomes known;
  // that's the one route-gating components should block on, so an action
  // like "save my ranking" -> refresh() doesn't unmount the page underneath
  // a "Loading..." screen and wipe local success/error state.
  const refresh = useCallback(async () => {
    if (!user) {
      setMembership(null);
      setLoading(false);
      setInitialized(true);
      return;
    }
    setLoading(true);
    const { membership: m } = await getMyMembership();
    setMembership(m);
    setLoading(false);
    setInitialized(true);
  }, [user]);

  useEffect(() => {
    // Wait for AuthContext's own session check to resolve first — otherwise
    // this fires once with `user` still null (before the real session is
    // known), which would mark `initialized` true with no membership and
    // briefly bounce a genuinely-signed-in admin/big/little through
    // Onboarding before the real membership loads.
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  // Runs a create/join action stashed at signup time, the first time this
  // user is seen with no membership yet (i.e. right after email
  // confirmation on the same device/browser they signed up with).
  useEffect(() => {
    if (isGuest || !user || loading || membership || autoSubmitAttempted) return;

    const action = readPendingGroupAction();
    if (!action) return;

    setAutoSubmitAttempted(true);
    (async () => {
      if (action.mode === 'create' && action.groupName) {
        await createGroup(action.groupName);
      } else if (action.mode === 'join' && action.groupId && action.role) {
        await requestToJoinGroup(action.groupId, action.role);
      }
      clearPendingGroupAction();
      await refresh();
    })();
  }, [isGuest, user, loading, membership, autoSubmitAttempted, refresh]);

  const value: GroupContextType = { membership, loading, initialized, refresh };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};
