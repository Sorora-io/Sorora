import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { updateGroupProfile, updateGroupSettings, getGroupAdmins, transferGroupOwnership, GroupAdmin } from '../../lib/groups';

const Settings = () => {
  const { membership, refresh } = useGroup();
  const group = membership?.group;

  const [name, setName] = useState(group?.name ?? '');
  const [school, setSchool] = useState(group?.school ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [minBig, setMinBig] = useState(group?.min_big_rankings ?? 5);
  const [minLittle, setMinLittle] = useState(group?.min_little_rankings ?? 5);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [admins, setAdmins] = useState<GroupAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState('');
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSaved, setTransferSaved] = useState(false);

  const loadAdmins = useCallback(async () => {
    if (!group) return;
    setAdminsLoading(true);
    const { admins: list } = await getGroupAdmins(group.id);
    setAdmins(list);
    setAdminsLoading(false);
  }, [group]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  if (!group) return null;

  const isOwner = membership?.user_id === group.owner_id;
  const owner = admins.find(a => a.user_id === group.owner_id);
  const otherAdmins = admins.filter(a => a.user_id !== group.owner_id);

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setTransferSaving(true);
    setTransferError('');
    setTransferSaved(false);
    const { error: transferErr } = await transferGroupOwnership(group.id, transferTarget);
    if (transferErr) {
      setTransferError(transferErr);
    } else {
      setTransferSaved(true);
      setConfirmingTransfer(false);
      setTransferTarget('');
      await Promise.all([refresh(), loadAdmins()]);
    }
    setTransferSaving(false);
  };

  const handleSaveProfile = async () => {
    if (name.trim() === '') {
      setProfileError('Please enter a name for your sorority group.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    setProfileSaved(false);
    const { error: saveError } = await updateGroupProfile(group.id, name.trim(), school.trim());
    if (saveError) {
      setProfileError(saveError);
    } else {
      setProfileSaved(true);
      await refresh();
    }
    setProfileSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: saveError } = await updateGroupSettings(group.id, minBig, minLittle);
    if (saveError) {
      setError(saveError);
    } else {
      setSaved(true);
      await refresh();
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Group Settings</h2>

        <div className="flex flex-col gap-4 mb-8 pb-8 border-b border-gray-200">
          <div>
            <label className="block text-sm font-medium mb-1">Sorority group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alpha Beta Chapter"
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. New York University"
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          {profileError && <p className="text-brick text-sm">{profileError}</p>}
          {profileSaved && <p className="text-jade-700 text-sm">Saved.</p>}

          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
          >
            {profileSaving ? '...' : 'Save Name & School'}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Bigs a Little must rank
            </label>
            <input
              type="number"
              min={1}
              value={minLittle}
              onChange={(e) => setMinLittle(Number(e.target.value))}
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Littles a Big must rank
            </label>
            <input
              type="number"
              min={1}
              value={minBig}
              onChange={(e) => setMinBig(Number(e.target.value))}
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          {error && <p className="text-brick text-sm">{error}</p>}
          {saved && <p className="text-jade-700 text-sm">Saved.</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Save Settings'}
          </button>
        </div>

        <div className="flex flex-col gap-3 mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold">Ownership</h3>
          {adminsLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isOwner ? (
            <>
              <p className="text-sm text-gray-600">You're the owner of this chapter.</p>
              {otherAdmins.length === 0 ? (
                <p className="text-sm text-gray-500">
                  There's no other admin to hand ownership to yet — approve someone else as admin
                  first.
                </p>
              ) : !confirmingTransfer ? (
                <>
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                  >
                    <option value="">Choose a new owner…</option>
                    {otherAdmins.map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.profile?.name || a.profile?.email || 'Unknown'}
                      </option>
                    ))}
                  </select>
                  {transferSaved && <p className="text-jade-700 text-sm">Ownership transferred.</p>}
                  <button
                    onClick={() => setConfirmingTransfer(true)}
                    disabled={!transferTarget}
                    className="w-full py-3 border-2 border-brick text-brick rounded-md hover:bg-brick-50 transition-colors disabled:opacity-50"
                  >
                    Transfer Ownership
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-brick-50 border-2 border-brick rounded-md">
                  <p className="text-sm text-brick font-medium">
                    Transfer ownership to{' '}
                    {otherAdmins.find(a => a.user_id === transferTarget)?.profile?.name ||
                      otherAdmins.find(a => a.user_id === transferTarget)?.profile?.email}
                    ? You'll remain an admin, but they'll be the only one who can transfer ownership
                    again.
                  </p>
                  {transferError && <p className="text-brick text-sm">{transferError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingTransfer(false)}
                      className="flex-1 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleTransfer}
                      disabled={transferSaving}
                      className="flex-1 py-2 bg-brick text-white rounded-md hover:bg-brick-600 transition-colors disabled:opacity-50 text-sm"
                    >
                      {transferSaving ? '...' : 'Confirm Transfer'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Owner: {owner?.profile?.name || owner?.profile?.email || 'Unknown'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
