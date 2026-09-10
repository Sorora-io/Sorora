import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import { requestRoleChange, groupLabel, MembershipRole } from '../lib/groups';
import { getMyProfile, updateMyProfile, uploadAvatar, deleteMyAccount } from '../lib/profile';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Profile = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut, updatePassword } = useAuth();
  const { membership, memberships, setActiveGroupId, refresh } = useGroup();

  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showAddOrg, setShowAddOrg] = useState(false);

  // Requesting a role change is a per-org action — each org's own row in
  // "Your Organizations" tracks its own open/selected/saving/error state
  // rather than sharing one global control tied to whichever org happens to
  // be active.
  const [roleChangeOpenId, setRoleChangeOpenId] = useState<string | null>(null);
  const [requestedRoleByOrg, setRequestedRoleByOrg] = useState<Record<string, MembershipRole>>({});
  const [roleErrorByOrg, setRoleErrorByOrg] = useState<Record<string, string>>({});
  const [roleSentByOrg, setRoleSentByOrg] = useState<Record<string, boolean>>({});
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);
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

  // Name, bio, and school info save independently of each other — each
  // section gets its own status so editing one never implies (or requires)
  // touching the others.
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  const [bioError, setBioError] = useState('');
  const [bioSaved, setBioSaved] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);

  const [schoolError, setSchoolError] = useState('');
  const [schoolSaved, setSchoolSaved] = useState(false);
  const [schoolSaving, setSchoolSaving] = useState(false);

  const [signOutConfirming, setSignOutConfirming] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setProfileLoading(false);
      return;
    }
    (async () => {
      const { profile } = await getMyProfile();
      if (profile) {
        setName(profile.name ?? '');
        setBio(profile.bio ?? '');
        setMajor(profile.major ?? '');
        setCollege(profile.college ?? '');
        setYear(profile.year ?? '');
        setHometown(profile.hometown ?? '');
        setAvatarUrl(profile.avatar_url);
      }
      setProfileLoading(false);
    })();
  }, [isGuest]);

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
    const { error: saveError } = await updateMyProfile(name, bio, url, major, college, year, hometown);
    if (saveError) {
      setAvatarError(saveError);
    } else {
      setAvatarUrl(url);
    }
    setAvatarUploading(false);
  };

  const handleSaveName = async () => {
    setNameSaving(true);
    setNameError('');
    setNameSaved(false);
    const { error } = await updateMyProfile(name.trim(), bio, avatarUrl, major, college, year, hometown);
    if (error) setNameError(error);
    else setNameSaved(true);
    setNameSaving(false);
  };

  const handleSaveBio = async () => {
    setBioSaving(true);
    setBioError('');
    setBioSaved(false);
    const { error } = await updateMyProfile(name, bio.trim(), avatarUrl, major, college, year, hometown);
    if (error) setBioError(error);
    else setBioSaved(true);
    setBioSaving(false);
  };

  const handleSaveSchool = async () => {
    setSchoolSaving(true);
    setSchoolError('');
    setSchoolSaved(false);
    const { error } = await updateMyProfile(
      name,
      bio,
      avatarUrl,
      major.trim(),
      college.trim(),
      year.trim(),
      hometown.trim()
    );
    if (error) setSchoolError(error);
    else setSchoolSaved(true);
    setSchoolSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSaved(false);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSaved(true);
      setNewPassword('');
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

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      {isGuest ? (
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-2xl font-semibold mb-4">Profile</h2>
          <p className="text-gray-600">
            You're browsing as a guest, so there's no account to manage here. Sign in or create an
            account to set a password or join a sorority group.
          </p>
        </div>
      ) : (
        <div className="max-w-5xl w-full">
          <h2 className="text-2xl font-semibold mb-6">Profile</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-4 mb-5">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative w-20 h-20 flex-shrink-0 rounded-full overflow-hidden border border-jade-300 bg-gray-100 flex items-center justify-center hover:border-jade-600 transition-colors disabled:opacity-50"
                  aria-label="Change profile picture"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold text-gray-400">
                      {(name || user?.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center text-white text-[10px] font-medium opacity-0 hover:opacity-100">
                    {avatarUploading ? '...' : 'Change'}
                  </span>
                </button>
                <div className="min-w-0">
                  <p className="text-sm text-gray-600 truncate">{user?.email}</p>
                  {avatarError && <p className="text-brick text-sm mt-1">{avatarError}</p>}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <h3 className="text-sm font-semibold mb-2">Name</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={profileLoading}
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                />
                {nameError && <p className="text-brick text-sm">{nameError}</p>}
                {nameSaved && <p className="text-jade-700 text-sm">Name updated.</p>}
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving || profileLoading}
                  className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {nameSaving ? '...' : 'Save Name'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-2">Bio</h3>
              <div className="flex flex-col gap-2">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A little about you"
                  rows={3}
                  disabled={profileLoading}
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50 resize-none"
                />
                {bioError && <p className="text-brick text-sm">{bioError}</p>}
                {bioSaved && <p className="text-jade-700 text-sm">Bio updated.</p>}
                <button
                  onClick={handleSaveBio}
                  disabled={bioSaving || profileLoading}
                  className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {bioSaving ? '...' : 'Save Bio'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-2">School info</h3>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Major"
                    disabled={profileLoading}
                    className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="College"
                    disabled={profileLoading}
                    className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Graduating Year"
                    disabled={profileLoading}
                    className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    placeholder="Hometown"
                    disabled={profileLoading}
                    className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                </div>
                {schoolError && <p className="text-brick text-sm">{schoolError}</p>}
                {schoolSaved && <p className="text-jade-700 text-sm">School info updated.</p>}
                <button
                  onClick={handleSaveSchool}
                  disabled={schoolSaving || profileLoading}
                  className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {schoolSaving ? '...' : 'Save School Info'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-2">Change password</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  minLength={6}
                  className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                />
                {passwordError && <p className="text-brick text-sm">{passwordError}</p>}
                {passwordSaved && <p className="text-jade-700 text-sm">Password updated.</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {passwordSaving ? '...' : 'Update Password'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 md:col-span-2">
              <h3 className="text-sm font-semibold mb-2">Your Organizations</h3>

              <div className="flex flex-col gap-2 mb-3">
                {memberships.map(m => {
                  const active = m.group_id === membership?.group_id;
                  const roleChangeOpen = roleChangeOpenId === m.id;
                  const requestedRole = requestedRoleByOrg[m.id] ?? 'big';
                  return (
                    <div
                      key={m.id}
                      className={`px-3 py-2 rounded-md border ${
                        active ? 'border-jade-600' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{groupLabel(m.group)}</p>
                          <p className="text-xs text-gray-500">
                            {roleLabel[m.role]}
                            {m.status !== 'approved' && ` (${m.status})`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {m.status === 'approved' && !m.requested_role && (
                            <button
                              onClick={() => setRoleChangeOpenId(roleChangeOpen ? null : m.id)}
                              className="text-sm underline text-gray-600 hover:text-black"
                            >
                              {roleChangeOpen ? 'Cancel' : 'Change role'}
                            </button>
                          )}
                          {active ? (
                            <span className="text-xs text-gray-400">Active</span>
                          ) : (
                            <button
                              onClick={() => setActiveGroupId(m.group_id)}
                              className="text-sm underline text-gray-600 hover:text-black"
                            >
                              Switch
                            </button>
                          )}
                        </div>
                      </div>

                      {m.status === 'approved' && m.requested_role && (
                        <p className="text-xs text-gray-500 mt-2">
                          Your request to become {roleLabel[m.requested_role]} is waiting on your
                          admin's approval.
                        </p>
                      )}

                      {roleChangeOpen && (
                        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
                          <select
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
                    </div>
                  );
                })}
                {memberships.length === 0 && (
                  <p className="text-sm text-gray-500">You're not part of any organization yet.</p>
                )}
              </div>

              {showAddOrg ? (
                <AddOrganizationForm
                  onCreated={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
                  onJoined={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
                  onCancel={() => setShowAddOrg(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddOrg(true)}
                  className="w-full py-2.5 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors text-sm"
                >
                  + Add Organization
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Sign out</h3>
                <p className="text-xs text-gray-500">You can always sign back in later.</p>
              </div>
              {signOutConfirming ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSignOutConfirming(false)}
                    className="py-2.5 px-4 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={signOut}
                    className="py-2.5 px-4 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors"
                  >
                    Yes, sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSignOutConfirming(true)}
                  className="py-2.5 px-6 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors flex-shrink-0"
                >
                  Sign out
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 border border-brick-100 md:col-span-2">
              <h3 className="text-sm font-semibold text-brick mb-1">Danger Zone</h3>

              {!deleteOpen ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Permanently delete your account and all its data.</p>
                  <button
                    onClick={() => setDeleteOpen(true)}
                    className="py-2 px-4 border border-brick text-brick rounded-md hover:bg-brick-50 transition-colors text-sm flex-shrink-0"
                  >
                    Delete Account
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-brick-50 border border-brick rounded-md p-4">
                    <p className="text-sm text-brick font-medium mb-2">This can't be undone.</p>
                    <p className="text-sm text-brick">
                      Deleting your account permanently removes your profile, organization memberships,
                      rankings, and notes. If you currently own a chapter, you'll need to{' '}
                      <Link to="/group/settings" className="underline">
                        transfer ownership
                      </Link>{' '}
                      to another admin first — this won't go through until you do.
                    </p>
                  </div>

                  <label className="text-sm text-gray-600">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full p-3 border border-brick-200 rounded-md focus:border-brick focus:outline-none focus:ring-2 focus:ring-brick-100"
                  />
                  {deleteError && <p className="text-brick text-sm">{deleteError}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDeleteOpen(false); setDeleteConfirmText(''); setDeleteError(''); }}
                      className="flex-1 py-2.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE' || deleteSaving}
                      className="flex-1 py-2.5 bg-brick text-white rounded-md hover:bg-brick-600 transition-colors disabled:opacity-50"
                    >
                      {deleteSaving ? '...' : 'Permanently Delete Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
