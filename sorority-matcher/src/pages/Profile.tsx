import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import { requestRoleChange, groupLabel, MembershipRole } from '../lib/groups';
import { getMyProfile, updateMyProfile, uploadAvatar } from '../lib/profile';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Profile = () => {
  const { user, isGuest, signOut, updatePassword } = useAuth();
  const { membership, memberships, setActiveGroupId, refresh } = useGroup();

  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showAddOrg, setShowAddOrg] = useState(false);

  const [requestedRole, setRequestedRole] = useState<MembershipRole>('big');
  const [roleError, setRoleError] = useState('');
  const [roleRequestSent, setRoleRequestSent] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);

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

  const handleRequestRoleChange = async () => {
    if (!membership) return;
    setRoleSaving(true);
    setRoleError('');
    const { error } = await requestRoleChange(membership.group_id, requestedRole);
    if (error) {
      setRoleError(error);
    } else {
      setRoleRequestSent(true);
      await refresh();
    }
    setRoleSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Profile</h2>

        {isGuest ? (
          <p className="text-gray-600">
            You're browsing as a guest, so there's no account to manage here. Sign in or create an
            account to set a password or join a sorority group.
          </p>
        ) : (
          <>
            <div className="mb-6 text-sm text-gray-600">
              <p>
                <span className="font-medium text-black">Email:</span> {user?.email}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-jade-300 bg-gray-100 flex items-center justify-center hover:border-jade-600 transition-colors disabled:opacity-50"
                aria-label="Change profile picture"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-gray-400">
                    {(name || user?.email || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center text-white text-xs font-medium opacity-0 hover:opacity-100">
                  {avatarUploading ? '...' : 'Change'}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              {avatarError && <p className="text-brick text-sm text-center">{avatarError}</p>}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold mb-2">Name</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={profileLoading}
                  className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                />
                {nameError && <p className="text-brick text-sm">{nameError}</p>}
                {nameSaved && <p className="text-jade-700 text-sm">Name updated.</p>}
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving || profileLoading}
                  className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {nameSaving ? '...' : 'Save Name'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-2">Bio</h3>
              <div className="flex flex-col gap-2">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A little about you"
                  rows={3}
                  disabled={profileLoading}
                  className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50 resize-none"
                />
                {bioError && <p className="text-brick text-sm">{bioError}</p>}
                {bioSaved && <p className="text-jade-700 text-sm">Bio updated.</p>}
                <button
                  onClick={handleSaveBio}
                  disabled={bioSaving || profileLoading}
                  className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {bioSaving ? '...' : 'Save Bio'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-2">School info</h3>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Major"
                    disabled={profileLoading}
                    className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="College"
                    disabled={profileLoading}
                    className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Graduating Year"
                    disabled={profileLoading}
                    className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    placeholder="Hometown"
                    disabled={profileLoading}
                    className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 disabled:opacity-50"
                  />
                </div>
                {schoolError && <p className="text-brick text-sm">{schoolError}</p>}
                {schoolSaved && <p className="text-jade-700 text-sm">School info updated.</p>}
                <button
                  onClick={handleSaveSchool}
                  disabled={schoolSaving || profileLoading}
                  className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {schoolSaving ? '...' : 'Save School Info'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-2">Change password</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  minLength={6}
                  className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                />
                {passwordError && <p className="text-brick text-sm">{passwordError}</p>}
                {passwordSaved && <p className="text-jade-700 text-sm">Password updated.</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                >
                  {passwordSaving ? '...' : 'Update Password'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-2">Your Organizations</h3>

              <div className="flex flex-col gap-2 mb-3">
                {memberships.map(m => {
                  const active = m.group_id === membership?.group_id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border-2 ${
                        active ? 'border-jade-600' : 'border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{groupLabel(m.group)}</p>
                        <p className="text-xs text-gray-500">
                          {roleLabel[m.role]}
                          {m.status !== 'approved' && ` (${m.status})`}
                        </p>
                      </div>
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
                  className="w-full py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors text-sm"
                >
                  + Add Organization
                </button>
              )}
            </div>

            {membership && membership.status === 'approved' && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-2">
                  Request a role change ({groupLabel(membership.group)})
                </h3>
                {membership.requested_role ? (
                  <p className="text-sm text-gray-600">
                    Your request to become {roleLabel[membership.requested_role]} is waiting on your
                    admin's approval.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as MembershipRole)}
                      className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                    >
                      <option value="admin">Admin</option>
                      <option value="big">Big</option>
                      <option value="little">Little</option>
                    </select>
                    {roleError && <p className="text-brick text-sm">{roleError}</p>}
                    {roleRequestSent && (
                      <p className="text-jade-700 text-sm">Request sent to your admin.</p>
                    )}
                    <button
                      onClick={handleRequestRoleChange}
                      disabled={roleSaving || requestedRole === membership.role}
                      className="w-full py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors disabled:opacity-50"
                    >
                      {roleSaving ? '...' : `Request to become ${roleLabel[requestedRole]}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={signOut}
              className="w-full mt-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
