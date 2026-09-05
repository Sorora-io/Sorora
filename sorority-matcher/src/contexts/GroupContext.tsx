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
  const { user, isGuest } = useAuth();
  const [membership, setMembership] = useState<MembershipWithGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { membership: m } = await getMyMembership();
    setMembership(m);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const value: GroupContextType = { membership, loading, refresh };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};
