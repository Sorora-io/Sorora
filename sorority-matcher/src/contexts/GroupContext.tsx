import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { MembershipWithGroup, MembershipRole, createGroup, requestToJoinGroup, getMyMemberships } from '../lib/groups';

const PENDING_ACTION_KEY = 'sorora-pending-group-action';
const ACTIVE_GROUP_KEY = 'sorora-active-group-id';

export interface PendingGroupAction {
  mode: 'create' | 'join';
  email: string;
  groupName?: string; // mode: create
  school?: string; // mode: create
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

export function clearPendingGroupAction() {
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
  error: string | null;
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
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<MembershipWithGroup[]>([]);
  const [membershipsUserId, setMembershipsUserId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(readActiveGroupId);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = user?.id ?? null;
  const identity = useRef(currentUserId);
  identity.current = currentUserId;
  const inFlight = useRef<{ userId: string | null; promise: Promise<void> } | null>(null);

  const setActiveGroupId = useCallback((groupId: string) => {
    writeActiveGroupId(groupId);
    setActiveGroupIdState(groupId);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    const userId = user?.id ?? null;
    if (inFlight.current?.userId === userId) return inFlight.current.promise;
    const task = (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user) {
          setMemberships([]);
          return;
        }
        let result = await getMyMemberships();
        if (identity.current !== userId) return;
        if (result.error) throw new Error(result.error);
        const action = readPendingGroupAction();
        // Only resume the action for the account that started it.
        if (action && action.email?.toLowerCase() === user.email?.toLowerCase()) {
          let groupId = action.groupId;
          if (action.mode === 'create' && action.groupName) {
            const created = await createGroup(action.groupName, action.school ?? '');
            if (created.error || !created.group) throw new Error(created.error ?? 'Could not create your chapter.');
            groupId = created.group.id;
          } else if (action.mode === 'join' && groupId && action.role) {
            if (!result.memberships.some(m => m.group_id === groupId)) {
              const joined = await requestToJoinGroup(groupId, action.role);
              if (joined.error) throw new Error(joined.error);
            }
          } else {
            throw new Error('Your chapter details are incomplete. Please start the chapter setup again.');
          }
          clearPendingGroupAction();
          if (identity.current !== userId) return;
          if (groupId) setActiveGroupId(groupId);
          result = await getMyMemberships();
          if (result.error) throw new Error(result.error);
        }
        if (identity.current === userId) {
          setMemberships(result.memberships);
          setMembershipsUserId(userId);
        }
      } catch (failure) {
        if (identity.current === userId) {
          setError(failure instanceof Error ? failure.message : 'Could not load your chapter. Please try again.');
        }
      } finally {
        if (identity.current === userId) {
          setLoading(false);
          setLoadedUserId(userId);
        }
      }
    })();
    inFlight.current = { userId, promise: task };
    void task.finally(() => {
      if (inFlight.current?.promise === task) inFlight.current = null;
    });
    return task;
  }, [user, setActiveGroupId]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  const initialized = !authLoading && loadedUserId === currentUserId;
  const currentMemberships = initialized && user && membershipsUserId === user.id ? memberships : [];

  // Pick the "active" org: whichever matches the stored id, if it still
  // exists among this user's memberships; otherwise the first one.
  const membership =
    currentMemberships.find(m => m.group_id === activeGroupId) ?? currentMemberships[0] ?? null;

  // Keep the stored active id in sync once we know the real list (covers
  // first load, and the case where the previously-active org disappeared).
  useEffect(() => {
    if (membership && membership.group_id !== activeGroupId) {
      writeActiveGroupId(membership.group_id);
      setActiveGroupIdState(membership.group_id);
    }
  }, [membership, activeGroupId]);

  const value: GroupContextType = {
    memberships: currentMemberships,
    membership,
    setActiveGroupId,
    loading,
    initialized,
    error,
    refresh,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};
