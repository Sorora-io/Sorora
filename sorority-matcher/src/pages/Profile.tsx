import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import { requestRoleChange, MembershipRole } from '../lib/groups';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    const { error: saveError } = await updateMyProfile(name, bio, url);
    if (saveError) {
      setAvatarError(saveError);
    } else {
      setAvatarUrl(url);
    }
    setAvatarUploading(false);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileError('');
    setProfileSaved(false);
    const { error } = await updateMyProfile(name.trim(), bio.trim(), avatarUrl);
    if (error) {
      setProfileError(error);
    } else {
      setProfileSaved(true);
    }
    setProfileSaving(false);
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
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
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
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 bg-gray-100 flex items-center justify-center hover:border-black transition-colors disabled:opacity-50"
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
              {avatarError && <p className="text-red-600 text-sm text-center">{avatarError}</p>}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold mb-2">Name &amp; bio</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={profileLoading}
                  className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none disabled:opacity-50"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A little about you"
                  rows={3}
                  disabled={profileLoading}
                  className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none disabled:opacity-50 resize-none"
                />
                {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
                {profileSaved && <p className="text-green-700 text-sm">Profile updated.</p>}
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving || profileLoading}
                  className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {profileSaving ? '...' : 'Save Profile'}
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
                  className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
                />
                {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
                {passwordSaved && <p className="text-green-700 text-sm">Password updated.</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
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
                        active ? 'border-black' : 'border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{m.group.name} · {m.group.school}</p>
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
                  className="w-full py-3 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-sm"
                >
                  + Add Organization
                </button>
              )}
            </div>

            {membership && membership.status === 'approved' && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-2">
                  Request a role change ({membership.group.name} · {membership.group.school})
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
                      className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="big">Big</option>
                      <option value="little">Little</option>
                    </select>
                    {roleError && <p className="text-red-600 text-sm">{roleError}</p>}
                    {roleRequestSent && (
                      <p className="text-green-700 text-sm">Request sent to your admin.</p>
                    )}
                    <button
                      onClick={handleRequestRoleChange}
                      disabled={roleSaving || requestedRole === membership.role}
                      className="w-full py-3 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {roleSaving ? '...' : `Request to become ${roleLabel[requestedRole]}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={signOut}
              className="w-full mt-6 py-3 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
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
