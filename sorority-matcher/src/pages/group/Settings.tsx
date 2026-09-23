import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import {
  updateBlindRankings,
  updateGroupProfile,
  updateGroupDescription,
  updateGroupSettings,
  updateGroupDeadline,
  updateRevealEmailTemplate,
  renderRevealTemplate,
  DEFAULT_REVEAL_SUBJECT,
  DEFAULT_REVEAL_BODY,
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
  const navigate = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const beginEdit = (section: string) => {
    setName(group?.name ?? '');
    setSchool(group?.school ?? '');
    setDescription(group?.description ?? '');
    setRevealSubject(group?.reveal_email_subject ?? '');
    setRevealBody(group?.reveal_email_body ?? '');
    setMinBig(group?.min_big_rankings ?? 5);
    setMinLittle(group?.min_little_rankings ?? 5);
    setDeadline(group?.ranking_deadline ?? '');
    setProfileError(''); setDescError(''); setRevealError(''); setError('');
    setEditing(section);
  };
  const finishSave = () => {
    setEditing(null);
    toast.success('Changes saved', { duration: 2500 });
  };

  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const toggleBlindRankings = async () => {
    if (!group) return;
    setPrivacySaving(true);
    setPrivacyError('');
    try {
      const result = await updateBlindRankings(group.id, !(group.blind_rankings ?? true));
      if (result.error) throw new Error(result.error);
      await refresh();
      finishSave();
    } catch (failure) {
      setPrivacyError(failure instanceof Error ? failure.message : 'Could not save ranking privacy.');
    } finally {
      setPrivacySaving(false);
    }
  };

  const [revealSubject, setRevealSubject] = useState(group?.reveal_email_subject ?? '');
  const [revealBody, setRevealBody] = useState(group?.reveal_email_body ?? '');
  const [revealSaving, setRevealSaving] = useState(false);
  const [revealError, setRevealError] = useState('');
  const revealUsingDefault = !revealSubject.trim() && !revealBody.trim();
  const previewSubject = renderRevealTemplate(revealSubject.trim() || DEFAULT_REVEAL_SUBJECT, {
    first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group?.name || 'Your chapter', little_count: 1,
  });
  const previewBody = renderRevealTemplate(revealBody.trim() || DEFAULT_REVEAL_BODY, {
    first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group?.name || 'Your chapter', little_count: 1,
  });
  const handleSaveReveal = async () => {
    if (!group) return;
    setRevealSaving(true);
    setRevealError('');
    // Empty string = "clear my override, fall back to the default template"
    // — clients don't have to know the default string themselves.
    const result = await updateRevealEmailTemplate(
      group.id,
      revealSubject.trim() || null,
      revealBody.trim() || null,
    );
    if (result.error) {
      setRevealError(result.error);
    } else {
      await refresh();
      finishSave();
    }
    setRevealSaving(false);
  };
  const handleResetReveal = () => {
    setRevealSubject('');
    setRevealBody('');
    setRevealError('');
  };

  const [name, setName] = useState(group?.name ?? '');
  const [school, setSchool] = useState(group?.school ?? '');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [description, setDescription] = useState(group?.description ?? '');
  const [descError, setDescError] = useState('');
  const [descSaving, setDescSaving] = useState(false);

  const [minBig, setMinBig] = useState(group?.min_big_rankings ?? 5);
  const [minLittle, setMinLittle] = useState(group?.min_little_rankings ?? 5);
  const [deadline, setDeadline] = useState(group?.ranking_deadline ?? '');
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
    const { error: saveError } = await updateGroupProfile(group.id, name.trim(), school.trim());
    if (saveError) {
      setProfileError(saveError);
    } else {
      await refresh();
      finishSave();
    }
    setProfileSaving(false);
  };

  const handleSaveDescription = async () => {
    setDescSaving(true);
    setDescError('');
    const { error: saveError } = await updateGroupDescription(group.id, description.trim());
    if (saveError) {
      setDescError(saveError);
    } else {
      await refresh();
      finishSave();
    }
    setDescSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
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
      await refresh();
      finishSave();
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-2xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} /> Back to dashboard
          </Button>
        </PageHeader>

        <span className="ss-kicker">Chapter</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)] mb-8">
          Organization settings
        </h1>

        <section className="mb-6 pb-6 border-b border-[color:var(--ss-surface-border)]">
          {editing === 'profile' ? <div className="flex flex-col gap-4">

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

          <Button onClick={handleSaveProfile} disabled={profileSaving} fullWidth>
            {profileSaving ? '...' : 'Save Name & School'}
          </Button>

            <Button variant="ghost" disabled={profileSaving} onClick={() => setEditing(null)}>Cancel</Button>
          </div> : <>
            <dl className="space-y-4"><div><dt className="ss-label">Sorority group name</dt><dd className="mt-1 text-xl font-medium">{group.name}</dd></div><div><dt className="ss-label">School</dt><dd className="mt-1">{group.school || 'Not added'}</dd></div></dl>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => beginEdit('profile')} disabled={editing !== null}>Edit organization</Button>
          </>}
        </section>

        <section className="mb-6 pb-6 border-b border-[color:var(--ss-surface-border)]">
          {editing === 'description' ? <div className="flex flex-col gap-4">

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

          <Button onClick={handleSaveDescription} disabled={descSaving} fullWidth>
            {descSaving ? '...' : 'Save Description'}
          </Button>

            <Button variant="ghost" disabled={descSaving} onClick={() => setEditing(null)}>Cancel</Button>
          </div> : <>
            <h2 className="ss-label">Description</h2><p className="mt-2 whitespace-pre-wrap">{group.description || 'No description added.'}</p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => beginEdit('description')} disabled={editing !== null}>Edit description</Button>
          </>}
        </section>

        <section className="ss-surface mb-6" aria-labelledby="ranking-privacy-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="ranking-privacy-title" className="text-base font-medium">Blind rankings</h2>
            {editing === 'privacy' ? <button type="button" role="switch" aria-checked={group.blind_rankings ?? true}
              aria-label="Blind rankings" aria-describedby="ranking-privacy-description"
              disabled={privacySaving} onClick={toggleBlindRankings}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${(group.blind_rankings ?? true) ? 'bg-[color:var(--ss-jade-deep)]' : 'bg-gray-300'}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${(group.blind_rankings ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
            </button> : <Button variant="outline" size="sm" disabled={editing !== null} onClick={() => beginEdit('privacy')}>Edit privacy</Button>}
          </div>
          {editing === 'privacy' && <Button className="mt-3" variant="ghost" size="sm" disabled={privacySaving} onClick={() => setEditing(null)}>Cancel</Button>}
          <p id="ranking-privacy-description" className="ss-caption mt-3">
            {(group.blind_rankings ?? true)
              ? 'On — only members can view their own preferences. Admins see submission status and final pairings, even when they participate in matching.'
              : 'Off — chapter admins can access members’ ranked preferences. Other members can still only see their own rankings.'}
          </p>
          <p className="ss-caption mt-2">Matching runs on the server either way. Turning this on cannot erase preferences an admin has already seen.</p>
          {privacyError && <p role="alert" className="mt-2 text-sm text-brick">{privacyError}</p>}
        </section>

        <section className="ss-surface mb-6" aria-labelledby="reveal-template-title">
          <h2 id="reveal-template-title" className="text-base font-medium">Pairing reveal email</h2>
          {editing === 'reveal' ? <>
          <p className="ss-caption mt-1">
            Sent to each Big when you reveal pairings. Leave blank to use the default. Merge tags:
            {' '}<code className="text-[color:var(--ss-ink-2)]">{'{{first_name}}'}</code>,
            {' '}<code className="text-[color:var(--ss-ink-2)]">{'{{little_names}}'}</code>,
            {' '}<code className="text-[color:var(--ss-ink-2)]">{'{{chapter_name}}'}</code>.
          </p>

          <label className="ss-label mt-4 block" htmlFor="reveal-subject">Subject</label>
          <input
            id="reveal-subject"
            type="text"
            value={revealSubject}
            onChange={e => setRevealSubject(e.target.value)}
            placeholder={DEFAULT_REVEAL_SUBJECT}
            className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
          />

          <label className="ss-label mt-4 block" htmlFor="reveal-body">Body</label>
          <textarea
            id="reveal-body"
            value={revealBody}
            onChange={e => setRevealBody(e.target.value)}
            placeholder={DEFAULT_REVEAL_BODY}
            rows={7}
            className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-y font-mono text-sm"
          />

          <div className="mt-4">
            <p className="ss-kicker">Preview {revealUsingDefault && '(default)'}</p>
            <div className="mt-2 rounded-md border border-[color:var(--ss-surface-border)] bg-white/60 p-3 text-sm">
              <p className="font-medium text-[color:var(--ss-ink-2)]">{previewSubject}</p>
              <p className="mt-2 whitespace-pre-wrap text-[color:var(--ss-ink-3)]">{previewBody}</p>
            </div>
            <p className="ss-caption mt-1">Preview uses Sarah / Emma Davis / your chapter name as sample values.</p>
          </div>

          {revealError && <p role="alert" className="mt-3 text-sm text-brick">{revealError}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSaveReveal} disabled={revealSaving}>
              {revealSaving ? '…' : 'Save template'}
            </Button>
            <Button variant="ghost" onClick={handleResetReveal} disabled={revealSaving || revealUsingDefault}>
              Reset to default
            </Button>
          </div>
          <Button variant="ghost" disabled={revealSaving} onClick={() => setEditing(null)}>Cancel</Button>
          </> : <>
            <p className="ss-caption mt-2">{group.reveal_email_subject || group.reveal_email_body ? 'Custom email template' : 'Default email template'}</p>
            <p className="mt-4 font-medium">{renderRevealTemplate(group.reveal_email_subject || DEFAULT_REVEAL_SUBJECT, { first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group.name, little_count: 1 })}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{renderRevealTemplate(group.reveal_email_body || DEFAULT_REVEAL_BODY, { first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group.name, little_count: 1 })}</p>
            <p className="ss-caption mt-2">Example shown with Sarah and Emma Davis.</p>
            <Button className="mt-4" variant="outline" size="sm" disabled={editing !== null} onClick={() => beginEdit('reveal')}>Edit email template</Button>
          </>}
        </section>

        <section>
          <h2 className="text-base font-medium mb-4">Ranking rules</h2>
          {editing === 'rules' ? <>
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

          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? '...' : 'Save Ranking Rules'}
          </Button>
        </div>

          <Button className="mt-3" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
          </> : <>
            <dl className="space-y-4">
              <div><dt className="ss-label">Minimum Bigs a Little must rank</dt><dd className="mt-1">{group.min_little_rankings}</dd></div>
              <div><dt className="ss-label">Minimum Littles a Big must rank</dt><dd className="mt-1">{group.min_big_rankings}</dd></div>
              <div><dt className="ss-label">Ranking deadline</dt><dd className="mt-1">{group.ranking_deadline ? formatDate(`${group.ranking_deadline}T12:00:00`) : 'No deadline set'}</dd></div>
            </dl>
            <Button className="mt-4" variant="outline" size="sm" disabled={editing !== null} onClick={() => beginEdit('rules')}>Edit ranking rules</Button>
          </>}
        </section>

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
                  <Button variant="quiet" size="sm" onClick={() => navigate('/group/pairings')}>
                    View a past cycle's pairings
                  </Button>
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
            <p className="text-sm text-[color:var(--ss-ink-4)]">
              Owner: {owner?.profile?.name || owner?.profile?.email || 'Unknown'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Settings;
