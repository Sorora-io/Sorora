import PageHeader from '../../components/PageHeader';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { invalidateChapter } from '../../lib/cache';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import LoadingLogo from '../../components/LoadingLogo';
import {
  getPendingMemberships,
  updateMembershipStatus,
  getPendingRoleChanges,
  resolveRoleChange,
  getGroupMembers,
  setMemberAdmin,
  removeMember,
  RoleChangeRequest,
  GroupMember,
} from '../../lib/groups';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Approvals = () => {
  const { membership, refresh } = useGroup();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const group = membership?.group;

  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [adminSavingId, setAdminSavingId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState('');
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removeSavingId, setRemoveSavingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');

  const joinLink = group ? `${window.location.origin}/login?join=${group.join_code}` : '';

  const { data, isPending: loading, error: loadError } = useQuery({
    queryKey: queryKeys.approvals(user?.id ?? '', group?.id ?? ''),
    enabled: !!user && !!group,
    queryFn: async () => {
      const [pendingResult, rolesResult, membersResult] = await Promise.all([
        getPendingMemberships(group!.id), getPendingRoleChanges(group!.id), getGroupMembers(group!.id),
      ]);
      const failure = pendingResult.error || rolesResult.error || membersResult.error;
      if (failure) throw new Error(failure);
      return { pending: pendingResult.memberships, roleChanges: rolesResult.requests, members: membersResult.members };
    },
  });
  const pending = data?.pending ?? [];
  const roleChanges = data?.roleChanges ?? [];
  const members = data?.members ?? [];
  const refreshAfterChange = async () => {
    if (user && group) await invalidateChapter(queryClient, user.id, group.id, group.active_cycle_id);
    await refresh();
  };

  const handleDecision = async (membershipId: string, status: 'approved' | 'rejected') => {
    const { error: updateError } = await updateMembershipStatus(membershipId, status);
    if (updateError) {
      setError(updateError);
      return;
    }
    await refreshAfterChange();
  };

  const handleRoleDecision = async (r: RoleChangeRequest, approve: boolean) => {
    const { error: updateError } = await resolveRoleChange(r.id, approve, r.requested_role!);
    if (updateError) {
      setError(updateError);
      return;
    }
    await refreshAfterChange();
  };

  const handleToggleAdmin = async (m: GroupMember) => {
    setAdminSavingId(m.id);
    setAdminError('');
    const { error: toggleError } = await setMemberAdmin(m.id, !m.is_admin);
    if (toggleError) {
      setAdminError(toggleError);
    } else {
      await refreshAfterChange();
    }
    setAdminSavingId(null);
  };

  const handleRemove = async (membershipId: string) => {
    setRemoveSavingId(membershipId);
    setRemoveError('');
    const { error: removeError } = await removeMember(membershipId);
    if (removeError) {
      setRemoveError(removeError);
    } else {
      await refreshAfterChange();
      setRemoveConfirmId(null);
    }
    setRemoveSavingId(null);
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

  const rowClass =
    'flex items-center justify-between gap-3 border-b border-[color:var(--ss-surface-border)] last:border-b-0 py-3';
  const primaryBtn =
    'px-4 py-2 rounded-pill text-sm bg-[color:var(--ss-jade-deep)] text-white hover:bg-[color:var(--ss-jade)] transition-colors';
  const quietBtn =
    'px-4 py-2 rounded-pill text-sm border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] hover:bg-white/60 transition-colors';
  const dangerBtn =
    'px-4 py-2 rounded-pill text-sm bg-brick text-white hover:bg-brick-600 transition-colors disabled:opacity-50';
  const dangerOutlineBtn =
    'px-4 py-2 rounded-pill text-sm border border-brick text-brick bg-transparent hover:bg-brick-50 transition-colors';

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </PageHeader>

        <span className="ss-kicker">01 · Needs attention</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Approvals
        </h1>
        <p className="mt-2 ss-caption">{group.name}{group.school && ` · ${group.school}`}</p>

        {/* Invite share */}
        <div className="mt-8 ss-surface">
          <div className="ss-kicker" style={{ marginBottom: 8 }}>Invite your chapter</div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[color:var(--ss-ink-5)] w-20">Chapter code</span>
              <code className="flex-1 bg-white/60 border border-[color:var(--ss-input-border)] rounded-lg px-3 py-2 font-mono tracking-widest text-[color:var(--ss-ink-1)]">
                {group.join_code}
              </code>
              <button onClick={() => copy(group.join_code, 'code')} className={quietBtn}>
                {copied === 'code' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[color:var(--ss-ink-5)] w-20">Join link</span>
              <code className="flex-1 bg-white/60 border border-[color:var(--ss-input-border)] rounded-lg px-3 py-2 text-sm truncate text-[color:var(--ss-ink-3)]">
                {joinLink}
              </code>
              <button onClick={() => copy(joinLink, 'link')} className={quietBtn}>
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Pending requests */}
        <div className="mt-6 ss-surface">
          <div className="ss-kicker" style={{ marginBottom: 8 }}>Pending requests</div>

          {(error || loadError) && <p className="text-[color:var(--ss-error)] text-sm mb-3">{error || loadError?.message}</p>}

          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : pending.length === 0 ? (
            <p className="ss-caption">No pending requests right now.</p>
          ) : (
            <div className="flex flex-col">
              {pending.map(m => (
                <div key={m.id} className={rowClass}>
                  <div className="min-w-0">
                    <p className="font-medium text-[color:var(--ss-ink-2)] truncate">
                      {m.profile?.name || m.profile?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-[color:var(--ss-ink-5)] truncate">
                      {m.profile?.email} · wants to join as {roleLabel[m.role]}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleDecision(m.id, 'rejected')} className={quietBtn}>
                      Reject
                    </button>
                    <button onClick={() => handleDecision(m.id, 'approved')} className={primaryBtn}>
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role change requests */}
        {roleChanges.length > 0 && (
          <div className="mt-6 ss-surface">
            <div className="ss-kicker" style={{ marginBottom: 8 }}>Role change requests</div>
            <div className="flex flex-col">
              {roleChanges.map(r => (
                <div key={r.id} className={rowClass}>
                  <div className="min-w-0">
                    <p className="font-medium text-[color:var(--ss-ink-2)] truncate">
                      {r.profile?.name || r.profile?.email || 'Unknown'}
                    </p>
                    <p className="text-sm text-[color:var(--ss-ink-5)] truncate">
                      {roleLabel[r.role]} → wants to become {roleLabel[r.requested_role!]}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleRoleDecision(r, false)} className={quietBtn}>
                      Reject
                    </button>
                    <button onClick={() => handleRoleDecision(r, true)} className={primaryBtn}>
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin access */}
        <div className="mt-6 ss-surface">
          <div className="ss-kicker" style={{ marginBottom: 4 }}>Admin access</div>
          <p className="ss-caption mb-4">
            Grant admin access to a Big or Little without changing their role — they'll keep ranking as
            normal and also get admin pages.
          </p>

          {adminError && <p className="text-[color:var(--ss-error)] text-sm mb-3">{adminError}</p>}

          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : (
            <div className="flex flex-col">
              {members
                .filter(m => m.role === 'big' || m.role === 'little')
                .map(m => (
                  <div key={m.id} className={rowClass}>
                    <div className="min-w-0">
                      <p className="font-medium text-[color:var(--ss-ink-2)] truncate">
                        {m.profile?.name || m.profile?.email || 'Unknown'}
                      </p>
                      <p className="text-sm text-[color:var(--ss-ink-5)]">
                        {roleLabel[m.role]}
                        {m.is_admin && ' · Admin'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleAdmin(m)}
                      disabled={adminSavingId === m.id}
                      className={m.is_admin ? dangerOutlineBtn : primaryBtn}
                    >
                      {adminSavingId === m.id ? '…' : m.is_admin ? 'Revoke admin' : 'Make admin'}
                    </button>
                  </div>
                ))}
              {members.filter(m => m.role === 'big' || m.role === 'little').length === 0 && (
                <p className="ss-caption">No Bigs or Littles yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Members / remove */}
        <div className="mt-6 ss-surface">
          <div className="ss-kicker" style={{ marginBottom: 4 }}>Members</div>
          <p className="ss-caption mb-4">
            Remove someone who's graduated or left — this only removes them from this chapter, not their
            Sorora account, and clears their rankings/pairings/notes for it.
          </p>

          {removeError && <p className="text-[color:var(--ss-error)] text-sm mb-3">{removeError}</p>}

          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : (
            <div className="flex flex-col">
              {members.map(m => {
                const isOwner = m.user_id === group.owner_id;
                const isSelf = m.user_id === membership?.user_id;
                return (
                  <div key={m.id} className={rowClass}>
                    <div className="min-w-0">
                      <p className="font-medium text-[color:var(--ss-ink-2)] truncate">
                        {m.profile?.name || m.profile?.email || 'Unknown'}
                      </p>
                      <p className="text-sm text-[color:var(--ss-ink-5)]">
                        {roleLabel[m.role]}
                        {m.is_admin && m.role !== 'admin' && ' · Admin'}
                        {isOwner && ' · Owner'}
                        {isSelf && ' · You'}
                      </p>
                    </div>
                    {isOwner || isSelf ? null : removeConfirmId === m.id ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-[color:var(--ss-ink-5)]">Remove?</span>
                        <button
                          onClick={() => handleRemove(m.id)}
                          disabled={removeSavingId === m.id}
                          className={dangerBtn}
                        >
                          {removeSavingId === m.id ? '…' : 'Yes, remove'}
                        </button>
                        <button onClick={() => setRemoveConfirmId(null)} className={quietBtn}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRemoveConfirmId(m.id)}
                        className={`${dangerOutlineBtn} flex-shrink-0`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && <p className="ss-caption">No approved members yet.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Approvals;
