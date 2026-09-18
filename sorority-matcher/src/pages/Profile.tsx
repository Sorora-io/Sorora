import PageHeader from '../components/PageHeader';
import { useMyProfile } from '../hooks/useMyProfile';
import { invalidateChapter } from '../lib/cache';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import Button from '../components/Button';
import { requestRoleChange, MembershipRole } from '../lib/groups';
import { updateMyProfile, uploadAvatar, deleteMyAccount } from '../lib/profile';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

export const ProfileContent = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, signOut, signIn, updatePassword } = useAuth();
  const { membership, refresh } = useGroup();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);


  // Keep role request state tied to the current membership.
  const [roleChangeOpenId, setRoleChangeOpenId] = useState<string | null>(null);
  const [requestedRoleByOrg, setRequestedRoleByOrg] = useState<Record<string, MembershipRole>>({});
  const [roleErrorByOrg, setRoleErrorByOrg] = useState<Record<string, string>>({});
  const [roleSentByOrg, setRoleSentByOrg] = useState<Record<string, boolean>>({});
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);

  const { data: profile, isPending: profileLoading, error: profileError } = useMyProfile();
  const loadError = profileError?.message ?? '';
  const seeded = useRef(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [college, setCollege] = useState('');
  const [year, setYear] = useState('');
  const [hometown, setHometown] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [signOutConfirming, setSignOutConfirming] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    setName(profile.name ?? '');
    setBio(profile.bio ?? '');
    setMajor(profile.major ?? '');
    setCollege(profile.college ?? '');
    setYear(profile.year ?? '');
    setHometown(profile.hometown ?? '');
    setAvatarUrl(profile.avatar_url);
  }, [profile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError('');
    const { url, error } = await uploadAvatar(file);
    if (error || !url) {
      setAvatarError(error ?? 'Could not upload image.');
      setAvatarUploading(false);
      return;
    }
    setAvatarUrl(url);
    setSaved(false);
    setAvatarUploading(false);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const { profile: updated, error } = await updateMyProfile(name.trim(), bio.trim(), avatarUrl, major.trim(), college.trim(), year.trim(), hometown.trim());
      if (error) setSaveError(error);
      else {
        setSaved(true);
        if (updated) queryClient.setQueryData(queryKeys.myProfile(user!.id), updated);
        else await queryClient.invalidateQueries({ queryKey: queryKeys.myProfile(user!.id) });
        if (membership) await invalidateChapter(queryClient, user!.id, membership.group_id, membership.group.active_cycle_id);
      }
    } catch {
      setSaveError('Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSaved(false);

    if (!user?.email) {
      setPasswordError('Could not verify your account. Please sign in again.');
      setPasswordSaving(false);
      return;
    }
    const { error: verifyError } = await signIn(user.email, oldPassword);
    if (verifyError) {
      setPasswordError('Current password is incorrect.');
      setPasswordSaving(false);
      return;
    }

    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSaved(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordSaving(false);
  };

  const handleRequestRoleChange = async (membershipId: string, groupId: string, role: MembershipRole) => {
    setRoleSavingId(membershipId);
    setRoleErrorByOrg(prev => ({ ...prev, [membershipId]: '' }));
    const { error } = await requestRoleChange(groupId, role);
    if (error) {
      setRoleErrorByOrg(prev => ({ ...prev, [membershipId]: error }));
    } else {
      setRoleSentByOrg(prev => ({ ...prev, [membershipId]: true }));
      await refresh();
      if (user && membership) await invalidateChapter(queryClient, user.id, membership.group_id, membership.group.active_cycle_id);
    }
    setRoleSavingId(null);
  };

  const handleDeleteAccount = async () => {
    setDeleteSaving(true);
    setDeleteError('');
    const { error } = await deleteMyAccount();
    if (error) {
      setDeleteError(error);
      setDeleteSaving(false);
      return;
    }
    await signOut();
    navigate('/');
  };

  const m = membership;
  const roleChangeOpen = !!m && roleChangeOpenId === m.id;
  const requestedRole = m ? requestedRoleByOrg[m.id] ?? 'big' : 'big';
  const inputClass = 'ss-input !min-h-[44px] !py-2.5 !px-3.5';

  return (
    <div className="w-full">
      <h1 className="font-sans text-[30px] font-semibold leading-[1.2] tracking-[-0.9px] text-[color:var(--ss-ink-1)]">Your profile</h1>
      <p className="mt-2 mb-7 text-[color:var(--ss-ink-5)]">A little about you, all in one place.</p>
      <form onSubmit={handleSave} onChange={() => setSaved(false)} className="rounded-xl border border-[color:var(--ss-surface-border)] bg-white/60 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4 border-b border-[color:var(--ss-surface-border)] pb-6 mb-6">
          <div className="w-20 h-20 shrink-0 rounded-full overflow-hidden bg-[color:var(--ss-pill-bg)] flex items-center justify-center">
            {avatarUrl ? <img src={avatarUrl} alt="Your profile" className="w-full h-full object-cover" /> : <span className="font-display text-3xl">{name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '?'}</span>}
          </div>
          <div className="flex-1 min-w-[140px]">
            <h2 className="font-display text-2xl sm:text-3xl break-words">{name || 'Your name'}</h2>
            <p className="text-sm text-[color:var(--ss-ink-5)] break-words">{[college, year && `Class of ${year}`].filter(Boolean).join(' · ') || 'Make yourself at home.'}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => avatarInputRef.current?.click()} disabled={profileLoading || saving || avatarUploading || !!loadError}>{avatarUploading ? 'Uploading…' : 'Change photo'}</Button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarChange} className="hidden" aria-label="Choose profile photo" />
        </div>
        {avatarError && <p role="alert" className="text-brick text-sm mb-4">{avatarError}</p>}
        {loadError && <p role="alert" className="text-brick text-sm mb-4">Could not load your profile: {loadError}. Please reload to try again.</p>}
        <fieldset disabled={profileLoading || saving || !!loadError} className="space-y-5 disabled:opacity-60">
          <div><label htmlFor="profile-name" className="ss-label">Name</label><input id="profile-name" className={inputClass} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
          <div><label htmlFor="profile-bio" className="ss-label">Bio</label><textarea id="profile-bio" className={`${inputClass} resize-y`} rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="A little about you" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-x-6">
            {[{id: 'major', label: 'Major', value: major, set: setMajor}, {id: 'college', label: 'College', value: college, set: setCollege}, {id: 'year', label: 'Graduating year', value: year, set: setYear}, {id: 'hometown', label: 'Hometown', value: hometown, set: setHometown}].map(field => <div key={field.id}><label htmlFor={`profile-${field.id}`} className="ss-label">{field.label}</label><input id={`profile-${field.id}`} className={inputClass} value={field.value} onChange={e => field.set(e.target.value)} /></div>)}
          </div>
        </fieldset>
        <div className="mt-7 pt-5 border-t border-[color:var(--ss-surface-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="ss-caption">Your profile helps your chapter get to know you.</p><p role="status" className="text-sm text-jade-700">{profileLoading ? 'Loading profile…' : saved ? 'Changes saved.' : ''}</p>{saveError && <p role="alert" className="text-brick text-sm">{saveError}</p>}</div>
          <Button type="submit" disabled={saving || profileLoading || avatarUploading || !!loadError}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
      <details className="group mt-4 rounded-xl border border-[color:var(--ss-surface-border)] bg-white/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-7 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-display text-xl">Chapter membership</span>
            {m && <span className="inline-flex flex-wrap gap-2"><span className="ss-pill">{m.group.name}</span><span className="ss-pill">{roleLabel[m.role]}</span></span>}
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl leading-none text-[color:var(--ss-jade)] transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-5 sm:px-7 pb-6">
          {m ? <>
            <p className="ss-caption mb-3">{m.group.school && `${m.group.school} · `}Membership status: {m.status}</p>
            {m.status === 'approved' && !m.requested_role && <Button variant="outline" size="sm" onClick={() => setRoleChangeOpenId(roleChangeOpen ? null : m.id)}>{roleChangeOpen ? 'Cancel' : 'Request role change'}</Button>}
                      {m.status === 'approved' && m.requested_role && (
                        <p className="text-xs text-gray-500 mt-2">
                          Your request to become {roleLabel[m.requested_role]} is waiting on your
                          admin's approval.
                        </p>
                      )}

                      {roleChangeOpen && (
                        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
                          <select
                            aria-label="Requested chapter role"
                            value={requestedRole}
                            onChange={(e) =>
                              setRequestedRoleByOrg(prev => ({ ...prev, [m.id]: e.target.value as MembershipRole }))
                            }
                            className="w-full p-2 text-sm border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                          >
                            <option value="admin">Admin</option>
                            <option value="big">Big</option>
                            <option value="little">Little</option>
                          </select>
                          {roleErrorByOrg[m.id] && <p className="text-brick text-xs">{roleErrorByOrg[m.id]}</p>}
                          {roleSentByOrg[m.id] && <p className="text-jade-700 text-xs">Request sent to your admin.</p>}
                          <button
                            onClick={() => handleRequestRoleChange(m.id, m.group_id, requestedRole)}
                            disabled={roleSavingId === m.id || requestedRole === m.role}
                            className="w-full py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors disabled:opacity-50"
                          >
                            {roleSavingId === m.id ? '...' : `Request to become ${roleLabel[requestedRole]}`}
                          </button>
                        </div>
                      )}

          </> : <p className="ss-caption">You haven't joined a chapter yet. <Link to="/group/onboarding" className="ss-link">Join your chapter</Link></p>}
        </div>
      </details>
      <details className="group mt-4 rounded-xl border border-[color:var(--ss-surface-border)] bg-white/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-7 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span className="font-display text-xl">Account settings</span>
            <span className="ss-caption mt-1">Password, sign out, and account management</span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl leading-none text-[color:var(--ss-jade)] transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-5 sm:px-7 pb-6 space-y-5">
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-2">Change password</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  aria-label="Current password"
                  placeholder="Current password"
                  autoComplete="current-password"
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-label="New password"
                  placeholder="New password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-label="Confirm new password"
                  placeholder="Confirm new password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                />
                {passwordError && <p className="text-brick text-sm">{passwordError}</p>}
                {passwordSaved && <p className="text-jade-700 text-sm">Password updated.</p>}
                <Button fullWidth onClick={handleChangePassword} disabled={passwordSaving}>
                  {passwordSaving ? '...' : 'Update Password'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Sign out</h3>
                <p className="text-xs text-gray-500">You can always sign back in later.</p>
              </div>
              {signOutConfirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => setSignOutConfirming(false)}>
                    Cancel
                  </Button>
                  <Button onClick={signOut}>
                    Yes, sign out
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="flex-shrink-0" onClick={() => setSignOutConfirming(true)}>
                  Sign out
                </Button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 border border-brick-100 md:col-span-2">
              <h3 className="text-sm font-semibold text-brick mb-1">Danger Zone</h3>

              {!deleteOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">Permanently delete your account and all its data.</p>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete Account
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-brick-50 border border-brick rounded-md p-4">
                    <p className="text-sm text-brick font-medium mb-2">This can't be undone.</p>
                    <p className="text-sm text-brick">
                      Deleting your account permanently removes your profile, chapter membership,
                      rankings, and notes. If you currently own a chapter, you'll need to{' '}
                      <Link to="/group/settings" className="underline">
                        transfer ownership
                      </Link>{' '}
                      to another admin first — this won't go through until you do.
                    </p>
                  </div>

                  <label htmlFor="delete-confirmation" className="text-sm text-gray-600">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                  </label>
                  <input
                    type="text"
                    id="delete-confirmation"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full p-3 border border-brick-200 rounded-md focus:border-brick focus:outline-none focus:ring-2 focus:ring-brick-100"
                  />
                  {deleteError && <p className="text-brick text-sm">{deleteError}</p>}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 !whitespace-normal"
                      onClick={() => { setDeleteOpen(false); setDeleteConfirmText(''); setDeleteError(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 !whitespace-normal"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE' || deleteSaving}
                    >
                      {deleteSaving ? '...' : 'Permanently Delete Account'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

        </div>
      </details>
    </div>
  );
};

const Profile = () => (
  <div className="min-h-screen px-5 sm:px-8 pb-12">
    <PageHeader className="max-w-5xl mx-auto py-5 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--ss-surface-border)]">
      <Link to="/" className="font-display text-3xl text-[color:var(--ss-ink-1)]">Sorora</Link>
      <nav aria-label="Main navigation" className="flex flex-wrap gap-1">
        {['Dashboard', 'Profile', 'Rankings', 'Roster', 'FAQ'].map(label => <Link key={label} to={label === 'Profile' ? '/profile' : `/dashboard?tab=${label.toLowerCase()}`} className="ss-tab !px-3 !text-sm" aria-current={label === 'Profile' ? 'page' : undefined}>{label}</Link>)}
      </nav>
    </PageHeader>
    <main className="max-w-4xl mx-auto pt-7">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-[color:var(--ss-ink-5)] mb-6"><ArrowLeft size={14} />Back to dashboard</Link>
      <ProfileContent />
    </main>
  </div>
);

export default Profile;
