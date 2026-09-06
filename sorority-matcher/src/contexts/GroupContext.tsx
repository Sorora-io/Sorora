import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { MembershipWithGroup, MembershipRole, createGroup, requestToJoinGroup, getMyMemberships } from '../lib/groups';

const PENDING_ACTION_KEY = 'sorora-pending-group-action';
const ACTIVE_GROUP_KEY = 'sorora-active-group-id';

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

function readActiveGroupId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

function writeActiveGroupId(groupId: string) {
  try {
    localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
  } catch {
    // ignore — the active org just won't survive a refresh
  }
}

interface GroupContextType {
  // All of the current user's organizations (any role/status).
  memberships: MembershipWithGroup[];
  // The one currently "active" — every /group/* page reads/writes this one.
  membership: MembershipWithGroup | null;
  setActiveGroupId: (groupId: string) => void;
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
  const [memberships, setMemberships] = useState<MembershipWithGroup[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(readActiveGroupId);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  // A ref, not state: React StrictMode double-invokes effects in
  // development against the same render's closure, so a useState guard set
  // synchronously at the top of the effect can still read as false on the
  // second invocation — which fired createGroup/requestToJoinGroup twice in
  // testing. A ref's mutation is visible immediately, closing that gap.
  const autoSubmitAttempted = useRef(false);

  const setActiveGroupId = useCallback((groupId: string) => {
    writeActiveGroupId(groupId);
    setActiveGroupIdState(groupId);
  }, []);

  // `loading` reflects any in-flight fetch (including a refresh() called
  // after a save, to pick up new data) — pages should feel free to ignore it
  // and keep their own content mounted. `initialized` only ever flips once,
  // from false to true, the first time membership status becomes known;
  // that's the one route-gating components should block on, so an action
  // like "save my ranking" -> refresh() doesn't unmount the page underneath
  // a "Loading..." screen and wipe local success/error state.
  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      setInitialized(true);
      return;
    }
    setLoading(true);
    const { memberships: list } = await getMyMemberships();
    setMemberships(list);
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
  // browser sees this user with no orgs yet (i.e. right after email
  // confirmation on the same device/browser they signed up with).
  useEffect(() => {
    if (isGuest || !user || loading || memberships.length > 0 || autoSubmitAttempted.current) return;

    const action = readPendingGroupAction();
    if (!action) return;

    autoSubmitAttempted.current = true;
    (async () => {
      if (action.mode === 'create' && action.groupName) {
        await createGroup(action.groupName);
      } else if (action.mode === 'join' && action.groupId && action.role) {
        await requestToJoinGroup(action.groupId, action.role);
      }
      clearPendingGroupAction();
      await refresh();
    })();
  }, [isGuest, user, loading, memberships, refresh]);

  // Pick the "active" org: whichever matches the stored id, if it still
  // exists among this user's memberships; otherwise the first one.
  const membership =
    memberships.find(m => m.group_id === activeGroupId) ?? memberships[0] ?? null;

  // Keep the stored active id in sync once we know the real list (covers
  // first load, and the case where the previously-active org disappeared).
  useEffect(() => {
    if (membership && membership.group_id !== activeGroupId) {
      writeActiveGroupId(membership.group_id);
      setActiveGroupIdState(membership.group_id);
    }
  }, [membership, activeGroupId]);

  const value: GroupContextType = {
    memberships,
    membership,
    setActiveGroupId,
    loading,
    initialized,
    refresh,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};
