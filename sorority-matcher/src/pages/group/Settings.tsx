import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import {
  updateGroupProfile,
  updateGroupDescription,
  updateGroupSettings,
  updateGroupDeadline,
  getGroupAdmins,
  transferGroupOwnership,
  getApprovedRoleCounts,
  getGroupCycles,
  startCycle,
  GroupAdmin,
  Cycle,
} from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const clamp = (value: number, min: number, max: number | undefined) => {
  if (Number.isNaN(value)) return min;
  let clamped = Math.max(value, min);
  if (max !== undefined) clamped = Math.min(clamped, max);
  return clamped;
};

const Settings = () => {
  const { membership, refresh } = useGroup();
  const group = membership?.group;

  const [name, setName] = useState(group?.name ?? '');
  const [school, setSchool] = useState(group?.school ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [description, setDescription] = useState(group?.description ?? '');
  const [descSaved, setDescSaved] = useState(false);
  const [descError, setDescError] = useState('');
  const [descSaving, setDescSaving] = useState(false);

  const [minBig, setMinBig] = useState(group?.min_big_rankings ?? 5);
  const [minLittle, setMinLittle] = useState(group?.min_little_rankings ?? 5);
  const [deadline, setDeadline] = useState(group?.ranking_deadline ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [bigCount, setBigCount] = useState<number | null>(null);
  const [littleCount, setLittleCount] = useState<number | null>(null);
  // min_big_rankings ("Littles a Big must rank") can't exceed how many
  // littles actually exist to rank, and vice versa — otherwise no one can
  // ever hit the requirement. 0 means "no one's joined that role yet",
  // which shouldn't block setting a starting number.
  const maxBig = littleCount && littleCount > 0 ? littleCount : undefined;
  const maxLittle = bigCount && bigCount > 0 ? bigCount : undefined;

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [newCycleLabel, setNewCycleLabel] = useState('');
  const [confirmingNewCycle, setConfirmingNewCycle] = useState(false);
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleError, setCycleError] = useState('');

  const loadCycles = useCallback(async () => {
    if (!group) return;
    setCyclesLoading(true);
    const { cycles: list } = await getGroupCycles(group.id);
    setCycles(list);
    setCyclesLoading(false);
  }, [group]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

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

  useEffect(() => {
    if (!group) return;
    getApprovedRoleCounts(group.id).then(({ bigs, littles }) => {
      setBigCount(bigs);
      setLittleCount(littles);
    });
  }, [group]);

  if (!group) return null;

  const isOwner = membership?.user_id === group.owner_id;
  const owner = admins.find(a => a.user_id === group.owner_id);
  const otherAdmins = admins.filter(a => a.user_id !== group.owner_id);
  const activeCycle = cycles.find(c => c.id === group.active_cycle_id);
  const pastCycles = cycles.filter(c => c.id !== group.active_cycle_id);

  const handleStartCycle = async () => {
    if (!newCycleLabel.trim()) return;
    setCycleSaving(true);
    setCycleError('');
    const { error: startError } = await startCycle(group.id, newCycleLabel.trim());
    if (startError) {
      setCycleError(startError);
    } else {
      setNewCycleLabel('');
      setConfirmingNewCycle(false);
      await Promise.all([refresh(), loadCycles()]);
    }
    setCycleSaving(false);
  };

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

  const handleSaveDescription = async () => {
    setDescSaving(true);
    setDescError('');
    setDescSaved(false);
    const { error: saveError } = await updateGroupDescription(group.id, description.trim());
    if (saveError) {
      setDescError(saveError);
    } else {
      setDescSaved(true);
      await refresh();
    }
    setDescSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const clampedMinBig = clamp(minBig, 1, maxBig);
    const clampedMinLittle = clamp(minLittle, 1, maxLittle);
    setMinBig(clampedMinBig);
    setMinLittle(clampedMinLittle);
    const [{ error: saveError }, { error: deadlineError }] = await Promise.all([
      updateGroupSettings(group.id, clampedMinBig, clampedMinLittle),
      updateGroupDeadline(group.id, deadline || null),
    ]);
    if (saveError || deadlineError) {
      setError(saveError ?? deadlineError ?? 'Could not save.');
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

      <div className="max-w-md w-full">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-4">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-6">Group Settings</h2>

        <div className="flex flex-col gap-4 mb-5 pb-5 border-b border-gray-200">
          <div>
            <label className="block text-sm font-medium mb-1">Sorority group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alpha Beta Chapter"
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. New York University"
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          {profileError && <p className="text-brick text-sm">{profileError}</p>}
          {profileSaved && <p className="text-jade-700 text-sm">Saved.</p>}

          <Button onClick={handleSaveProfile} disabled={profileSaving} fullWidth>
            {profileSaving ? '...' : 'Save Name & School'}
          </Button>
        </div>

        <div className="flex flex-col gap-4 mb-5 pb-5 border-b border-gray-200">
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A little about your chapter — shown to members and prospective joiners"
              rows={3}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-none"
            />
          </div>

          {descError && <p className="text-brick text-sm">{descError}</p>}
          {descSaved && <p className="text-jade-700 text-sm">Saved.</p>}

          <Button onClick={handleSaveDescription} disabled={descSaving} fullWidth>
            {descSaving ? '...' : 'Save Description'}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Bigs a Little must rank
            </label>
            <input
              type="number"
              min={1}
              max={maxLittle}
              value={minLittle}
              onChange={(e) => setMinLittle(clamp(Number(e.target.value), 1, maxLittle))}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {bigCount === null ? ' ' : `You have ${bigCount} approved big${bigCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Littles a Big must rank
            </label>
            <input
              type="number"
              min={1}
              max={maxBig}
              value={minBig}
              onChange={(e) => setMinBig(clamp(Number(e.target.value), 1, maxBig))}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {littleCount === null ? ' ' : `You have ${littleCount} approved little${littleCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ranking deadline (optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <p className="text-xs text-gray-500 mt-1">Shown to Bigs and Littles on their Dashboard.</p>
          </div>

          {error && <p className="text-brick text-sm">{error}</p>}
          {saved && <p className="text-jade-700 text-sm">Saved.</p>}

          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? '...' : 'Save Ranking Rules'}
          </Button>
        </div>

        <div className="flex flex-col gap-3 mt-5 pt-5 border-t border-gray-200">
          <h3 className="text-sm font-semibold">Rush Cycle</h3>
          {cyclesLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><LoadingLogo size={18} /> Loading...</div>
          ) : (
            <>
              {activeCycle && (
                <p className="text-sm text-gray-600">
                  Currently on <span className="font-medium">{activeCycle.label}</span>, started{' '}
                  {formatDate(activeCycle.started_at)}.
                </p>
              )}

              {pastCycles.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Past cycles</p>
                  {pastCycles.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm text-gray-600 px-1">
                      <span>{c.label}</span>
                      <span className="text-xs text-gray-400">
                        {formatDate(c.started_at)}
                        {c.ended_at ? ` – ${formatDate(c.ended_at)}` : ''}
                      </span>
                    </div>
                  ))}
                  <Link to="/group/pairings" className="text-xs text-gray-500 underline hover:text-black mt-1">
                    View a past cycle's pairings
                  </Link>
                </div>
              )}

              {!confirmingNewCycle ? (
                <Button variant="outline" size="sm" fullWidth onClick={() => setConfirmingNewCycle(true)}>
                  Start a New Cycle
                </Button>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-gold-50 border border-gold-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    Starting a new cycle closes {activeCycle ? `"${activeCycle.label}"` : 'the current cycle'} —
                    its rankings and pairings stay saved, but Bigs/Littles start ranking fresh under the new
                    cycle. Chapter membership isn't affected.
                  </p>
                  <input
                    type="text"
                    value={newCycleLabel}
                    onChange={(e) => setNewCycleLabel(e.target.value)}
                    placeholder="e.g. Spring 2027"
                    className="w-full p-2.5 text-sm border border-gold-300 rounded-md focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-100"
                  />
                  {cycleError && <p className="text-brick text-sm">{cycleError}</p>}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setConfirmingNewCycle(false); setCycleError(''); setNewCycleLabel(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleStartCycle}
                      disabled={cycleSaving || !newCycleLabel.trim()}
                    >
                      {cycleSaving ? '...' : 'Start Cycle'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-5 pt-5 border-t border-gray-200">
          <h3 className="text-sm font-semibold">Ownership</h3>
          {adminsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><LoadingLogo size={18} /> Loading...</div>
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
                    className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                  >
                    <option value="">Choose a new owner…</option>
                    {otherAdmins.map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.profile?.name || a.profile?.email || 'Unknown'}
                      </option>
                    ))}
                  </select>
                  {transferSaved && <p className="text-jade-700 text-sm">Ownership transferred.</p>}
                  <Button
                    variant="danger-outline"
                    fullWidth
                    onClick={() => setConfirmingTransfer(true)}
                    disabled={!transferTarget}
                  >
                    Transfer Ownership
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-brick-50 border border-brick rounded-md">
                  <p className="text-sm text-brick font-medium">
                    Transfer ownership to{' '}
                    {otherAdmins.find(a => a.user_id === transferTarget)?.profile?.name ||
                      otherAdmins.find(a => a.user_id === transferTarget)?.profile?.email}
                    ? You'll remain an admin, but they'll be the only one who can transfer ownership
                    again.
                  </p>
                  {transferError && <p className="text-brick text-sm">{transferError}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirmingTransfer(false)}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" className="flex-1" onClick={handleTransfer} disabled={transferSaving}>
                      {transferSaving ? '...' : 'Confirm Transfer'}
                    </Button>
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
