import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import {
  getPendingMemberships,
  updateMembershipStatus,
  getPendingRoleChanges,
  resolveRoleChange,
  getGroupMembers,
  setMemberAdmin,
  PendingMembership,
  RoleChangeRequest,
  GroupMember,
} from '../../lib/groups';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Approvals = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [pending, setPending] = useState<PendingMembership[]>([]);
  const [roleChanges, setRoleChanges] = useState<RoleChangeRequest[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [adminSavingId, setAdminSavingId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState('');

  const joinLink = group ? `${window.location.origin}/login?join=${group.join_code}` : '';

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    const [
      { memberships, error: loadError },
      { requests, error: roleError },
      { members: memberList, error: membersError },
    ] = await Promise.all([
      getPendingMemberships(group.id),
      getPendingRoleChanges(group.id),
      getGroupMembers(group.id),
    ]);
    if (loadError) setError(loadError);
    else if (roleError) setError(roleError);
    else if (membersError) setError(membersError);
    setPending(memberships);
    setRoleChanges(requests);
    setMembers(memberList);
    setLoading(false);
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = async (membershipId: string, status: 'approved' | 'rejected') => {
    const { error: updateError } = await updateMembershipStatus(membershipId, status);
    if (updateError) {
      setError(updateError);
      return;
    }
    setPending(prev => prev.filter(m => m.id !== membershipId));
  };

  const handleRoleDecision = async (r: RoleChangeRequest, approve: boolean) => {
    const { error: updateError } = await resolveRoleChange(r.id, approve, r.requested_role!);
    if (updateError) {
      setError(updateError);
      return;
    }
    setRoleChanges(prev => prev.filter(req => req.id !== r.id));
  };

  const handleToggleAdmin = async (m: GroupMember) => {
    setAdminSavingId(m.id);
    setAdminError('');
    const { error: toggleError } = await setMemberAdmin(m.id, !m.is_admin);
    if (toggleError) {
      setAdminError(toggleError);
    } else {
      setMembers(prev => prev.map(row => (row.id === m.id ? { ...row, is_admin: !row.is_admin } : row)));
    }
    setAdminSavingId(null);
  };

  const copy = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable — user can still select/copy manually
    }
  };

  if (!group) return null;

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-2xl font-semibold mb-1">{group.name}</h2>
        {group.school && <p className="text-gray-500 text-sm mb-1">{group.school}</p>}
        <p className="text-gray-500 text-sm mb-4">Share this with your chapter so they can join</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-20">Join code</span>
            <code className="flex-1 bg-gray-100 rounded-md px-3 py-2 font-mono tracking-widest">
              {group.join_code}
            </code>
            <button
              onClick={() => copy(group.join_code, 'code')}
              className="px-3 py-2 border-2 border-jade-300 rounded-md text-sm hover:bg-jade-50 transition-colors"
            >
              {copied === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-20">Join link</span>
            <code className="flex-1 bg-gray-100 rounded-md px-3 py-2 text-sm truncate">{joinLink}</code>
            <button
              onClick={() => copy(joinLink, 'link')}
              className="px-3 py-2 border-2 border-jade-300 rounded-md text-sm hover:bg-jade-50 transition-colors"
            >
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h3 className="text-xl font-semibold mb-4">Pending requests</h3>

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-gray-500">No pending requests right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between border-2 border-gray-200 rounded-md p-3">
                <div>
                  <p className="font-medium">{m.profile?.name || m.profile?.email || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">
                    {m.profile?.email} · wants to join as {roleLabel[m.role]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(m.id, 'rejected')}
                    className="px-4 py-2 border-2 border-jade-300 rounded-md text-sm hover:bg-jade-50 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleDecision(m.id, 'approved')}
                    className="px-4 py-2 bg-jade-600 text-white rounded-md text-sm hover:bg-jade-700 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {roleChanges.length > 0 && (
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 mt-6">
          <h3 className="text-xl font-semibold mb-4">Role change requests</h3>
          <div className="flex flex-col gap-3">
            {roleChanges.map(r => (
              <div key={r.id} className="flex items-center justify-between border-2 border-gray-200 rounded-md p-3">
                <div>
                  <p className="font-medium">{r.profile?.name || r.profile?.email || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">
                    {roleLabel[r.role]} → wants to become {roleLabel[r.requested_role!]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRoleDecision(r, false)}
                    className="px-4 py-2 border-2 border-jade-300 rounded-md text-sm hover:bg-jade-50 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleRoleDecision(r, true)}
                    className="px-4 py-2 bg-jade-600 text-white rounded-md text-sm hover:bg-jade-700 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 mt-6">
        <h3 className="text-xl font-semibold mb-1">Admin access</h3>
        <p className="text-gray-500 text-sm mb-4">
          Grant admin access to a Big or Little without changing their role — they'll keep ranking as
          normal and also get admin pages.
        </p>

        {adminError && <p className="text-brick text-sm mb-3">{adminError}</p>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {members
              .filter(m => m.role === 'big' || m.role === 'little')
              .map(m => (
                <div key={m.id} className="flex items-center justify-between border-2 border-gray-200 rounded-md p-3">
                  <div>
                    <p className="font-medium">{m.profile?.name || m.profile?.email || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">
                      {roleLabel[m.role]}
                      {m.is_admin && ' + Admin'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleAdmin(m)}
                    disabled={adminSavingId === m.id}
                    className={`px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50 ${
                      m.is_admin
                        ? 'border-2 border-brick text-brick hover:bg-brick-50'
                        : 'bg-jade-600 text-white hover:bg-jade-700'
                    }`}
                  >
                    {adminSavingId === m.id ? '...' : m.is_admin ? 'Revoke Admin' : 'Make Admin'}
                  </button>
                </div>
              ))}
            {members.filter(m => m.role === 'big' || m.role === 'little').length === 0 && (
              <p className="text-gray-500 text-sm">No Bigs or Littles yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Approvals;
