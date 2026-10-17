import { deadlineInput, deadlineTimeZones, formatRankingDeadline, groupRankingDeadline, parseDeadlineInput } from '../../lib/rankingDeadline';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { useState, useEffect, useCallback, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import {
  updateBlindRankings,
  updateGroupProfile,
  updateGroupDescription,
  updateGroupSettings,
  updateGroupDeadline,
  updateMaxLittlesPerBig,
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
  Group,
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

const sectionClass = 'mb-6 pb-6 border-b border-[color:var(--ss-surface-border)]';
const headingClass = 'text-base font-medium text-[color:var(--ss-ink-1)]';

const SettingsActions = ({ saving, onSave, onCancel, children }: {
  saving: boolean; onSave: () => void; onCancel: () => void; children?: ReactNode;
}) => <div className="mt-4 flex flex-wrap items-center gap-2">
  <Button size="sm" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save changes'}</Button>
  <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>Cancel</Button>
  {children}
</div>;

export interface SuperuserSettingsContext { group: Group; bigs: number; littles: number; refresh: () => Promise<void>; }
const Settings = ({ superuserContext, embedded = false }: { superuserContext?: SuperuserSettingsContext; embedded?: boolean }) => {
  const context = useGroup();
  const membership = context.membership;
  const refresh = superuserContext?.refresh ?? context.refresh;
  const group = superuserContext?.group ?? membership?.group;
  const superuserMode = !!superuserContext;
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
    const zone = group?.ranking_deadline_timezone || (groupRankingDeadline(group) ? 'UTC' : '');
    setDeadlineZone(zone);
    setDeadline(deadlineInput(groupRankingDeadline(group), zone || 'UTC'));
    setMaximum(group?.max_littles_per_big ?? 3);
    setMaximumError('');
    setProfileError(''); setDescError(''); setRevealError(''); setError('');
    setEditing(section);
  };
  const finishSave = () => {
    setEditing(null);
    toast.success('Changes saved', { duration: 2500 });
  };

  const [maximum, setMaximum] = useState(group?.max_littles_per_big ?? 3);
  const [maximumSaving, setMaximumSaving] = useState(false);
  const [maximumError, setMaximumError] = useState('');
  const saveMaximum = async () => {
    if (!group || maximumSaving) return;
    setMaximumSaving(true);
    setMaximumError('');
    try {
      const result = await updateMaxLittlesPerBig(group.id, maximum);
      if (result.error) throw new Error(result.error);
      await refresh();
      finishSave();
    } catch (failure) {
      setMaximumError(failure instanceof Error ? failure.message : 'Could not save the maximum.');
    } finally {
      setMaximumSaving(false);
    }
  };

  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [privacyDraft, setPrivacyDraft] = useState(group?.blind_rankings ?? true);
  useEffect(() => { setPrivacyDraft(group?.blind_rankings ?? true); setPrivacyError(''); }, [group?.id, group?.blind_rankings]);
  const privacyDirty = privacyDraft !== (group?.blind_rankings ?? true);
  const saveBlindRankings = async () => {
    if (!group || privacySaving) return;
    setPrivacySaving(true);
    setPrivacyError('');
    try {
      const result = await updateBlindRankings(group.id, privacyDraft);
      if (result.error) throw new Error(result.error);
      await refresh();
      toast.success('Changes saved', { duration: 2500 });
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
    try {
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
    } catch {
      setRevealError('Could not save the email template. Please try again.');
    } finally {
      setRevealSaving(false);
    }
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
  const [deadlineZone, setDeadlineZone] = useState(group?.ranking_deadline_timezone || (groupRankingDeadline(group) ? 'UTC' : ''));
  const [deadline, setDeadline] = useState(deadlineInput(groupRankingDeadline(group), deadlineZone || 'UTC'));
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
    if (!group || superuserMode) { setCyclesLoading(false); return; }
    setCyclesLoading(true);
    const { cycles: list } = await getGroupCycles(group.id);
    setCycles(list);
    setCyclesLoading(false);
  }, [group, superuserMode]);

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
    if (!group || superuserMode) { setAdminsLoading(false); return; }
    setAdminsLoading(true);
    const { admins: list } = await getGroupAdmins(group.id);
    setAdmins(list);
    setAdminsLoading(false);
  }, [group, superuserMode]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    if (!group) return;
    if (superuserContext) { setBigCount(superuserContext.bigs); setLittleCount(superuserContext.littles); return; }
    getApprovedRoleCounts(group.id).then(({ bigs, littles }) => {
      setBigCount(bigs);
      setLittleCount(littles);
    });
  }, [group, superuserContext]);

  if (!group) return null;

  const isOwner = !superuserMode && membership?.user_id === group.owner_id;
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
    try {
      const { error: saveError } = await updateGroupProfile(group.id, name.trim(), school.trim());
      if (saveError) {
        setProfileError(saveError);
      } else {
        await refresh();
        finishSave();
      }
    } catch {
      setProfileError('Could not save organization details. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    setDescSaving(true);
    setDescError('');
    try {
      const { error: saveError } = await updateGroupDescription(group.id, description.trim());
      if (saveError) {
        setDescError(saveError);
      } else {
        await refresh();
        finishSave();
      }
    } catch {
      setDescError('Could not save the description. Please try again.');
    } finally {
      setDescSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const parsed = parseDeadlineInput(deadline, deadlineZone);
    if (parsed.error) { setError(parsed.error); return; }
    setSaving(true);
    setError('');
    const clampedMinBig = clamp(minBig, 1, maxBig);
    const clampedMinLittle = clamp(minLittle, 1, maxLittle);
    setMinBig(clampedMinBig);
    setMinLittle(clampedMinLittle);
    try {
      const originalZone = group.ranking_deadline_timezone || (groupRankingDeadline(group) ? 'UTC' : '');
      const deadlineChanged = deadline !== deadlineInput(groupRankingDeadline(group), originalZone || 'UTC') || deadlineZone !== originalZone;
      const results = await Promise.all([
        updateGroupSettings(group.id, clampedMinBig, clampedMinLittle),
        deadlineChanged ? updateGroupDeadline(group.id, parsed.instant, deadlineZone || null) : Promise.resolve({ error: null }),
      ]);
      const failure = results.find(result => result.error);
      if (failure) { setError(failure.error || 'Could not save ranking rules.'); return; }
      await refresh();
      finishSave();
    } catch {
      setError('Could not confirm the ranking rules were saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? 'w-full' : "min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8"}>
      <section className={embedded ? 'w-full flex flex-col' : "ss-frost w-full max-w-2xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col"}>
        {!embedded && <PageHeader superuserMode={superuserMode} className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="quiet" size="sm" onClick={() => navigate(superuserMode ? '/superuser?view=organizations' : '/dashboard')}>
            <ArrowLeft size={14} aria-hidden="true" /> {superuserMode ? 'Back to organizations' : 'Back to dashboard'}
          </Button>
        </PageHeader>}

        {superuserMode && <p role="status" className="ss-caption mb-4">Superuser editor · {group.name}{group.school ? ` · ${group.school}` : ''}. Changes apply only to this organization.</p>}
        <span className="ss-kicker">Chapter</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)] mb-8">
          Organization settings
        </h1>

        <section className={sectionClass} aria-labelledby="organization-details-title">
          <h2 id="organization-details-title" className={`${headingClass} mb-4`}>Organization details</h2>
          {editing === 'profile' ? <>
          <div className="flex flex-col gap-4">

          <div>
            <label htmlFor="organization-name" className="ss-label block mb-1">Sorority group name</label>
            <input
              type="text"
              id="organization-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alpha Beta Chapter"
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          <div>
            <label htmlFor="organization-school" className="ss-label block mb-1">School</label>
            <input
              type="text"
              id="organization-school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. New York University"
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          {profileError && <p role="alert" className="text-brick text-sm">{profileError}</p>}

          </div>
          <SettingsActions saving={profileSaving} onSave={handleSaveProfile} onCancel={() => setEditing(null)} />
          </> : <>
            <dl className="space-y-4"><div><dt className="ss-label">Sorority group name</dt><dd className="mt-1 text-sm text-[color:var(--ss-ink-2)]">{group.name}</dd></div><div><dt className="ss-label">School</dt><dd className="mt-1 text-sm text-[color:var(--ss-ink-2)]">{group.school || 'Not added'}</dd></div></dl>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => beginEdit('profile')} disabled={editing !== null || privacyDirty || privacySaving}>Edit organization</Button>
          </>}
        </section>

        <section className={sectionClass} aria-labelledby="description-title">
          <h2 id="description-title" className={`${headingClass} mb-4`}>Description</h2>
          {editing === 'description' ? <>
          <div className="flex flex-col gap-4">

          <div>
            <label htmlFor="organization-description" className="ss-label block mb-1">Description</label>
            <textarea
              id="organization-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A little about your chapter — shown to members and prospective joiners"
              rows={3}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-none"
            />
          </div>

          {descError && <p role="alert" className="text-brick text-sm">{descError}</p>}

          </div>
          <SettingsActions saving={descSaving} onSave={handleSaveDescription} onCancel={() => setEditing(null)} />
          </> : <>
            <p className="text-sm text-[color:var(--ss-ink-3)] whitespace-pre-wrap">{group.description || 'No description added.'}</p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => beginEdit('description')} disabled={editing !== null || privacyDirty || privacySaving}>Edit description</Button>
          </>}
        </section>

        <section className={sectionClass} aria-labelledby="ranking-privacy-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="ranking-privacy-title" className={headingClass}>Blind rankings</h2>
            <button type="button" role="switch" aria-checked={privacyDraft}
              aria-label="Blind rankings" aria-describedby="ranking-privacy-description"
              disabled={privacySaving || editing !== null} onClick={() => { setPrivacyDraft(!privacyDraft); setPrivacyError(''); }}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${privacyDraft ? 'bg-[color:var(--ss-jade-deep)]' : 'bg-gray-300'}`}>
              <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${privacyDraft ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <p className="ss-caption mt-3">Choose who can see ranked preferences according to your organization’s policy. For example, if admins are also Bigs taking Littles, your organization may want their access limited to their own rankings. This setting applies to all chapter admins.</p>
          <p id="ranking-privacy-description" className="ss-caption mt-3">
            {privacyDraft
              ? 'On — only members can view their own preferences. Admins see submission status and final pairings, even when they participate in matching.'
              : 'Off — chapter admins can access members’ ranked preferences. Other members can still only see their own rankings.'}
          </p>
          <p className="ss-caption mt-2">Your organization decides whether admins need access to preferences to manage matching. Matching works with either setting. Turning this on cannot erase preferences an admin has already seen.</p>
          {privacyError && <p role="alert" className="mt-2 text-sm text-brick">{privacyError}</p>}
          {privacyDirty && <SettingsActions saving={privacySaving} onSave={saveBlindRankings} onCancel={() => { setPrivacyDraft(group.blind_rankings ?? true); setPrivacyError(''); }}>
            <span role="status" className="ss-caption">Unsaved changes</span>
          </SettingsActions>}
        </section>

        <section className={sectionClass} aria-labelledby="reveal-template-title">
          <h2 id="reveal-template-title" className={headingClass}>Pairing reveal email</h2>
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

          <SettingsActions saving={revealSaving} onSave={handleSaveReveal} onCancel={() => setEditing(null)}>
            <Button size="sm" variant="quiet" onClick={handleResetReveal} disabled={revealSaving || revealUsingDefault}>Reset to default</Button>
          </SettingsActions>
          </> : <>
            <p className="ss-caption mt-2">{group.reveal_email_subject || group.reveal_email_body ? 'Custom email template' : 'Default email template'}</p>
            <p className="mt-4 font-medium">{renderRevealTemplate(group.reveal_email_subject || DEFAULT_REVEAL_SUBJECT, { first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group.name, little_count: 1 })}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{renderRevealTemplate(group.reveal_email_body || DEFAULT_REVEAL_BODY, { first_name: 'Sarah', little_names: 'Emma Davis', chapter_name: group.name, little_count: 1 })}</p>
            <p className="ss-caption mt-2">Example shown with Sarah and Emma Davis.</p>
            <Button className="mt-4" variant="outline" size="sm" disabled={editing !== null || privacyDirty || privacySaving} onClick={() => beginEdit('reveal')}>Edit email template</Button>
          </>}
        </section>

        <section className={sectionClass} aria-labelledby="matching-rules-title">
          <h2 id="matching-rules-title" className={`${headingClass} mb-4`}>Matching rules</h2>
          {editing === 'matching' ? <>
            <label htmlFor="maximum-littles" className="ss-label block mb-1">Maximum Littles per Big</label>
            <select id="maximum-littles" value={maximum} onChange={e => setMaximum(Number(e.target.value) as 1 | 2 | 3)} disabled={maximumSaving} className="ss-input w-full">
              <option value={1}>1 Little</option>
              <option value={2}>2 Littles (twins)</option>
              <option value={3}>3 Littles (triplets)</option>
            </select>
            <p className="ss-caption mt-2">Lowering this limit automatically caps saved preferences for matching. A Big who chose 3 can receive up to 2 when the limit is 2, without resubmitting. Existing pairings stay as they are; first adjust any active pairings that exceed the new limit.</p>
            {maximumError && <p role="alert" className="text-brick text-sm mt-2">{maximumError}</p>}
            <SettingsActions saving={maximumSaving} onSave={saveMaximum} onCancel={() => setEditing(null)} />
          </> : <>
            <dl><dt className="ss-label">Maximum Littles per Big</dt><dd className="mt-1 text-sm">{group.max_littles_per_big ?? 3}</dd></dl>
            <p className="ss-caption mt-2">Each Big can choose fewer Littles within this limit. Saved preferences above the limit are automatically capped when matching runs.</p>
            <Button className="mt-4" variant="outline" size="sm" disabled={editing !== null || privacyDirty || privacySaving} onClick={() => beginEdit('matching')}>Edit matching rules</Button>
          </>}
        </section>

        <section className={sectionClass} aria-labelledby="ranking-rules-title">
          <h2 id="ranking-rules-title" className={`${headingClass} mb-4`}>Ranking rules</h2>
          {editing === 'rules' ? <>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="minimum-bigs" className="ss-label block mb-1">
              Minimum Bigs a Little must rank
            </label>
            <input
              type="number"
              min={1}
              max={maxLittle}
              id="minimum-bigs"
              value={minLittle}
              onChange={(e) => setMinLittle(clamp(Number(e.target.value), 1, maxLittle))}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <p className="ss-caption mt-1">
              {bigCount === null ? ' ' : `You have ${bigCount} approved big${bigCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <div>
            <label htmlFor="minimum-littles" className="ss-label block mb-1">
              Minimum Littles a Big must rank
            </label>
            <input
              type="number"
              min={1}
              max={maxBig}
              id="minimum-littles"
              value={minBig}
              onChange={(e) => setMinBig(clamp(Number(e.target.value), 1, maxBig))}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <p className="ss-caption mt-1">
              {littleCount === null ? ' ' : `You have ${littleCount} approved little${littleCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <div>
            <label htmlFor="ranking-deadline" className="ss-label block mb-1">Ranking deadline (optional)</label>
            <input
              type="datetime-local"
              id="ranking-deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
            <label htmlFor="deadline-timezone" className="ss-label block mt-3 mb-1">Deadline time zone{deadline ? ' (required)' : ''}</label>
            <select id="deadline-timezone" required={!!deadline} value={deadlineZone} onChange={event => setDeadlineZone(event.target.value)} className="w-full p-3 border border-jade-300 rounded-md bg-white">
              <option value="">Choose a time zone</option>
              {Array.from(new Set([...deadlineTimeZones, ...(deadlineZone ? [deadlineZone] : [])])).map(zone => <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>)}
            </select>
            <p className="ss-caption mt-1">Enter the date and time in your selected time zone. Submissions close at that exact time, which is shown to members. Leave the date and time blank for no deadline.</p>
            {deadline && !parseDeadlineInput(deadline, deadlineZone).error && <p className="ss-caption mt-2">Closes: {formatRankingDeadline({ ranking_deadline_at: parseDeadlineInput(deadline, deadlineZone).instant, ranking_deadline_timezone: deadlineZone })}</p>}
          </div>

          {error && <p role="alert" className="text-brick text-sm">{error}</p>}

        </div>
          <SettingsActions saving={saving} onSave={handleSave} onCancel={() => setEditing(null)} />
          </> : <>
            <dl className="space-y-4">
              <div><dt className="ss-label">Minimum Bigs a Little must rank</dt><dd className="mt-1 text-sm">{group.min_little_rankings}</dd></div>
              <div><dt className="ss-label">Minimum Littles a Big must rank</dt><dd className="mt-1 text-sm">{group.min_big_rankings}</dd></div>
              <div><dt className="ss-label">Ranking deadline</dt><dd className="mt-1 text-sm">{formatRankingDeadline(group)}</dd></div>
            </dl>
            <Button className="mt-4" variant="outline" size="sm" disabled={editing !== null || privacyDirty || privacySaving} onClick={() => beginEdit('rules')}>Edit ranking rules</Button>
          </>}
        </section>

        {superuserMode ? <section className="ss-surface">
          <p className="ss-caption">This editor covers organization details, privacy, ranking and matching rules, deadlines, and the reveal email template. Chapter admins manage cycle changes and member approvals. Ownership transfers are available in the superuser organization directory.</p>
          <Button variant="quiet" size="sm" className="mt-3" onClick={() => navigate('/superuser?view=organizations')}>Organization directory</Button>
        </section> : <>
        <div className={`${sectionClass} flex flex-col gap-3`}>
          <h2 className={headingClass}>Rush cycle</h2>
          {cyclesLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><LoadingLogo size={18} /> Loading...</div>
          ) : (
            <>
              {activeCycle && (
                <p className="ss-caption">
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
                <Button variant="outline" size="sm" className="self-start" disabled={editing !== null || privacyDirty || privacySaving} onClick={() => setConfirmingNewCycle(true)}>
                  Start a new cycle
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
                    aria-label="New cycle name"
                    placeholder="e.g. Spring 2027"
                    className="w-full p-2.5 text-sm border border-gold-300 rounded-md focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-100"
                  />
                  {cycleError && <p role="alert" className="text-brick text-sm">{cycleError}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleStartCycle} disabled={cycleSaving || !newCycleLabel.trim()}>
                      {cycleSaving ? 'Starting…' : 'Start cycle'}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={cycleSaving} onClick={() => { setConfirmingNewCycle(false); setCycleError(''); setNewCycleLabel(''); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`${sectionClass} flex flex-col gap-3`}>
          <h2 className={headingClass}>Ownership</h2>
          {adminsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><LoadingLogo size={18} /> Loading...</div>
          ) : isOwner ? (
            <>
              <p className="ss-caption">You're the owner of this chapter.</p>
              {otherAdmins.length === 0 ? (
                <p className="ss-caption">
                  There's no other admin to hand ownership to yet — approve someone else as admin
                  first.
                </p>
              ) : !confirmingTransfer ? (
                <>
                  <select
                    aria-label="New owner"
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
                    size="sm"
                    className="self-start"
                    onClick={() => setConfirmingTransfer(true)}
                    disabled={!transferTarget || editing !== null || privacyDirty || privacySaving}
                  >
                    Transfer ownership
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
                  {transferError && <p role="alert" className="text-brick text-sm">{transferError}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button variant="danger" size="sm" onClick={handleTransfer} disabled={transferSaving}>
                      {transferSaving ? 'Transferring…' : 'Confirm transfer'}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={transferSaving} onClick={() => setConfirmingTransfer(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[color:var(--ss-ink-4)]">
              Owner: {owner?.profile?.name || owner?.profile?.email || 'Unknown'}
            </p>
          )}
        </div>        </>}

      </section>
    </div>
  );
};

export default Settings;
