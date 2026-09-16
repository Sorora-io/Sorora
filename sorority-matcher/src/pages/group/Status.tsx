import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getSubmissionStatus, runMatching, SubmissionStatusRow } from '../../lib/rankings';
import { sendRankingReminders } from '../../lib/reminders';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const Status = () => {
  const navigate = useNavigate();
  const { membership } = useGroup();
  const group = membership?.group;

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
    queryKey: queryKeys.submissionStatus(cycleId ?? ''),
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
    const { error: runFailure } = await runMatching(group.id, cycleId);
    if (runFailure) {
      setRunError(runFailure);
      setRunning(false);
      return;
    }
    navigate('/group/pairings');
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

  if (!group) return null;

  const renderList = (label: string, list: SubmissionStatusRow[]) => (
    <div className="ss-surface">
      <div className="ss-kicker" style={{ marginBottom: 8 }}>
        {label} ({list.filter(r => r.submitted).length}/{list.length} submitted)
      </div>
      {list.length === 0 ? (
        <p className="ss-caption">No one approved yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
          {list.map(r => (
            <div key={r.userId} className="flex items-center justify-between py-2.5">
              <span className="text-[color:var(--ss-ink-2)] truncate">{r.name || r.email}</span>
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
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </header>

        <span className="ss-kicker">02 · Preference collection</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Submission status
        </h1>
        <p className="mt-3 ss-caption max-w-lg">
          See who's submitted their rankings and remind anyone who hasn't yet.
        </p>

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

        {error && <p className="mt-4 text-[color:var(--ss-error)] text-sm">{error}</p>}

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
