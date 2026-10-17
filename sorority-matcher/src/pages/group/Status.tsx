import MatchingReview from '../../components/MatchingReview';
import { trackEvent } from '../../lib/analytics';
import { littlePreferenceLabel } from '../../lib/littlePreference';
import { groupRankingDeadline } from '../../lib/rankingDeadline';
import MemberRankings from '../../components/MemberRankings';
import UnrankedMemberReview from '../../components/UnrankedMemberReview';
import { downloadRankingExport } from '../../lib/rankingExport';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getSubmissionStatus, runMatching, SubmissionStatusRow } from '../../lib/rankings';
import { sendRankingReminders } from '../../lib/reminders';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const Status = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showRankings = searchParams.get('view') === 'rankings';
  const { membership } = useGroup();
  const group = membership?.group;

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'submitted' | 'waiting'>('all');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [reminding, setReminding] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderError, setReminderError] = useState('');

  const cycleId = group?.active_cycle_id ?? null;

  const {
    data: rows = [] as SubmissionStatusRow[],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.submissionStatus(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getSubmissionStatus(group!.id, cycleId).then(({ rows: r, error: loadError }) => {
      if (loadError) throw new Error(loadError);
      return r;
    }),
    enabled: !!group && !!cycleId,
  });
  const error = runError || (queryError ? (queryError as Error).message : '');

  const bigs = rows.filter(r => r.role === 'big');
  const littles = rows.filter(r => r.role === 'little');
  const allSubmitted = rows.length > 0 && rows.every(r => r.submitted);

  const handleRun = async () => {
    if (!group || !cycleId) return;
    setRunning(true);
    setRunError('');
    try {
      const { error: runFailure } = await runMatching(group.id, cycleId);
      if (runFailure) { setRunError(runFailure); return; }
      trackEvent('matching_completed');
      navigate('/group/pairings');
    } catch {
      setRunError('Could not confirm whether matching finished. Check Pairings before running matching again.');
    } finally {
      setRunning(false);
    }
  };

  const handleRemind = async () => {
    if (!group) return;
    setReminding(true);
    setReminderError('');
    setReminderMessage('');
    const { result, error: sendError } = await sendRankingReminders(group.id);
    if (sendError) {
      setReminderError(sendError);
    } else if (result) {
      setReminderMessage(
        result.total === 0
          ? 'Everyone has already submitted.'
          : `Sent ${result.sent} of ${result.total} reminder ${result.total === 1 ? 'email' : 'emails'}.`
      );
    }
    setReminding(false);
  };

  const handleExport = async () => {
    if (!group || !cycleId) return;
    setExporting(true);
    setExportError('');
    setExportMessage('');
    try {
      await downloadRankingExport(group.id, cycleId, true);
      setExportMessage('Your CSV download is ready.');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!group) return null;

  const visibleMembers = (list: SubmissionStatusRow[]) => list.filter(member => submissionFilter === 'all' || member.submitted === (submissionFilter === 'submitted'));

  const renderList = (label: string, list: SubmissionStatusRow[]) => (
    <div className="ss-surface">
      <div className="ss-kicker" style={{ marginBottom: 8 }}>
        {label} ({list.filter(r => r.submitted).length}/{list.length} submitted)
      </div>
      {list.length === 0 ? (
        <p className="ss-caption">No one approved yet.</p>
      ) : visibleMembers(list).length === 0 ? (
        <p className="ss-caption">No members match this filter.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
          {visibleMembers(list).map(r => (
            <div key={r.userId} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className="block text-[color:var(--ss-ink-2)] truncate">{r.name || r.email}</span>
                {r.role === 'big' && <p className="ss-caption mt-1">Matching capacity: {littlePreferenceLabel(r, group.max_littles_per_big ?? 3)}</p>}
              </div>
              <span
                className={
                  r.submitted
                    ? 'text-[color:var(--ss-jade)] text-sm font-medium'
                    : 'text-[color:var(--ss-ink-5)] text-sm'
                }
              >
                {r.submitted ? 'Submitted' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="quiet" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to dashboard
          </Button>
        </PageHeader>

        <span className="ss-kicker">02 · Preference collection</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Submission status
        </h1>
        <p className="mt-3 ss-caption max-w-lg">
          {(group.blind_rankings ?? true)
            ? 'Blind rankings are on. You can see who has submitted, but only each member can view their own preferences.'
            : 'Blind rankings are off. Chapter admins can access members’ preferences.'} Matching runs on the server.
        </p>

        <p className="mt-4 text-sm font-medium">Chapter maximum: {group.max_littles_per_big ?? 3} Littles per Big. Saved choices above this limit are automatically capped for matching; members do not need to resubmit.</p>

        {cycleId && <div className="mt-5 max-w-sm">
          <label htmlFor="submission-filter" className="ss-label block mb-2">Submission filter</label>
          <select id="submission-filter" className="ss-input w-full" value={submissionFilter} onChange={event => setSubmissionFilter(event.target.value as 'all' | 'submitted' | 'waiting')}>
            <option value="all">All members</option>
            <option value="submitted">Submitted</option>
            <option value="waiting">Not submitted</option>
          </select>
        </div>}

        {!cycleId ? (
          <p className="mt-8 ss-caption">
            No active cycle yet — start one from Group Settings before collecting rankings.
          </p>
        ) : loading ? (
          <div className="mt-8 flex items-center gap-2 text-[color:var(--ss-ink-5)]">
            <LoadingLogo size={20} /> Loading…
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderList('Bigs', bigs)}
            {renderList('Littles', littles)}
          </div>
        )}

        {cycleId && (group.blind_rankings ?? true) && <section className="mt-6 ss-surface" aria-label="Individual member rankings">
          <h2 className="font-medium text-[color:var(--ss-ink-1)]">Individual member rankings</h2>
          <p className="mt-2 ss-caption">Blind rankings are on. Only each member can view their own preferences. Chapter admins can turn blind rankings off in Organization settings to enable this view.</p>
          <Button variant="quiet" size="sm" className="mt-3" onClick={() => navigate('/group/settings')}>Manage ranking privacy</Button>
        </section>}

        {cycleId && !(group.blind_rankings ?? true) && <MemberRankings key={`${user?.id}:${group.id}:${cycleId}:${showRankings}`} groupId={group.id} cycleId={cycleId} initiallyOpen={showRankings} />}

        {cycleId && <p className="mt-3 ss-caption">Matching capacity shows the chapter limit applied to each Big’s saved preference. A saved/default value of 1 cannot distinguish an explicit choice from the original default. Preferences may carry over between cycles; the submission label refers to this cycle. Twins do not apply to Littles.</p>}

        {cycleId && <MatchingReview groupId={group.id} cycleId={cycleId} />}
        {cycleId && <UnrankedMemberReview groupId={group.id} cycleId={cycleId} deadline={groupRankingDeadline(group)} blind={group.blind_rankings ?? true} />}

        {cycleId && <section className="mt-6 ss-surface">
          <h2 className="font-medium text-[color:var(--ss-ink-1)]">Ranked choices</h2>
          <p className="mt-2 ss-caption">One row per member, with twins/triplets preference and choices in rank order.</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || (group.blind_rankings ?? true)}>
              {exporting ? 'Downloading…' : 'Download ranked choices'}
            </Button>
          </div>
          {(group.blind_rankings ?? true) && <div className="mt-3">
            <p className="ss-caption">Blind rankings are on. Turn them off in Organization settings to download ranked choices.</p>
            <Button variant="quiet" size="sm" className="mt-2" onClick={() => navigate('/group/settings')}>Organization settings</Button>
          </div>}
          {exportError && <p role="alert" className="mt-3 text-sm text-[color:var(--ss-error)]">{exportError}</p>}
          {exportMessage && <p role="status" className="mt-3 ss-caption">{exportMessage}</p>}
        </section>}

        {error && <p role="alert" className="mt-4 text-[color:var(--ss-error)] text-sm">{error}</p>}

        {cycleId && !allSubmitted && !loading && (
          <div className="mt-6 ss-surface">
            <p className="text-[color:var(--ss-ink-3)] text-sm mb-3">
              Not everyone has submitted their ranking yet — you can still run matching, but unsubmitted
              members will be treated as having no preferences.
            </p>
            <Button variant="outline" size="sm" onClick={handleRemind} disabled={reminding}>
              {reminding ? 'Sending…' : 'Send reminder emails'}
            </Button>
            {reminderMessage && (
              <p className="text-[color:var(--ss-jade)] text-sm mt-2">{reminderMessage}</p>
            )}
            {reminderError && (
              <p className="text-[color:var(--ss-error)] text-sm mt-2">{reminderError}</p>
            )}
          </div>
        )}

        {cycleId && (
          <div className="mt-8">
            <Button size="lg" fullWidth onClick={handleRun} disabled={running || loading || rows.length === 0}>
              {running ? 'Running…' : 'Run matching'}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Status;
