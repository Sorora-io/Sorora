import { SHOW_MATCHING_EMAIL_TOOLS } from '../lib/features';
import Settings from './group/Settings';
import { RosterContent } from './group/Roster';
import { formatRankingDeadline, groupRankingDeadline, useRankingDeadline } from '../lib/rankingDeadline';
import { useCycleParticipation } from '../lib/cycleParticipation';
import { revealDeliveryWarning } from '../lib/revealStatus';
import PageHeader from '../components/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import ChooseMatchingRole from '../components/ChooseMatchingRole';
import MemberHeader, { MemberTab as TabId } from '../components/MemberHeader';
import { isEffectiveAdmin, MembershipWithGroup, getPendingMemberships } from '../lib/groups';
import { getSubmissionStatus, getMyRanking, getFullRoster, RosterEntry } from '../lib/rankings';
import { getPairingRevealStatus } from '../lib/pairings';
import { queryKeys, STALE } from '../lib/queryKeys';

const roleLabel = (m: MembershipWithGroup) => {
  const base =
    m.role === 'admin' ? 'Admin' : m.role === 'big' ? 'Big' : m.role === 'little' ? 'Little' : m.role;
  return m.is_admin && m.role !== 'admin' ? `${base} + Admin` : base;
};

const opposite = (role: string) => (role === 'big' ? 'little' : 'big');
const percent = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

// Shared, restrained heading scale for member workspace screens.
const Heading = ({ text }: { text: string }) => (
  <h1 className="ss-page-heading font-sans text-[color:var(--ss-ink-1)] whitespace-pre-line">{text}</h1>
);

const Sub = ({ text }: { text: string }) => (
  <p className="mt-2 text-[color:var(--ss-ink-5)] text-[14px] leading-[1.6] max-w-2xl">
    {text}
  </p>
);

// Section headings inside dashboard cards ("My littles rankings",
// "Chapter progress"). Also sans, 17px, matching the canvas's
// .ss-dash h3 rule.
const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="font-sans text-[color:var(--ss-ink-1)]"
    style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, margin: 0 }}
  >
    {children}
  </h2>
);

// ---------------------------------------------------------------------------
// Dashboard overview: admin tasks first, personal ranking status second.
// ---------------------------------------------------------------------------

export const DashboardTab = ({
  membership,
  onNavigate,
}: {
  membership: MembershipWithGroup;
  onNavigate: (path: string) => void;
}) => {
  const { user } = useAuth();
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const isAdmin = isEffectiveAdmin(membership);
  const cycleId = membership.group.active_cycle_id;
  const participation = useCycleParticipation(user?.id ?? '', membership.group_id, cycleId);
  const excluded = participation.data?.excludedIds.includes(user?.id ?? '') ?? false;
  const targetPlural = opposite(membership.role) === 'big' ? 'bigs' : 'littles';
  const minimum = membership.role === 'big' ? membership.group.min_big_rankings ?? 1 : membership.group.min_little_rankings ?? 1;
  const deadlineClosed = useRankingDeadline(groupRankingDeadline(membership.group));

  const { data: rankedIds, isPending: rankingPending, error: rankingError, refetch: retryRanking } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids, error }) => { if (error) throw new Error(error); return ids; }),
    enabled: isRanker && !!cycleId,
  });

  const { data: statusRows, isPending: statusPending, error: statusError, refetch: retryStatus } = useQuery({
    queryKey: queryKeys.submissionStatus(user?.id ?? '', cycleId ?? ''),
    queryFn: () =>
      getSubmissionStatus(membership.group_id, cycleId).then(({ rows, error }) => { if (error) throw new Error(error); return rows; }),
    enabled: isAdmin && !!cycleId,
  });

  const { data: pendingCount = 0, isPending: pendingPending, error: pendingError, refetch: retryPending } = useQuery({
    queryKey: queryKeys.pendingCount(user?.id ?? '', membership.group_id),
    queryFn: () => getPendingMemberships(membership.group_id).then(({ memberships: m, error }) => { if (error) throw new Error(error); return m.length; }),
    enabled: isAdmin,
    staleTime: STALE.short,
  });

  const { data: reveal, isPending: revealPending, isSuccess: revealReady, error: revealError, refetch: retryReveal } = useQuery({
    queryKey: queryKeys.revealStatus(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getPairingRevealStatus(membership.group_id, cycleId!).then(({ status, error }) => { if (error) throw new Error(error); return status; }),
    refetchInterval: 30_000,
    enabled: isAdmin && !!cycleId,
    staleTime: STALE.short,
  });

  const chapterLoading = pendingPending || (!!cycleId && (statusPending || revealPending));
  const submitted = (rankedIds?.length ?? 0) > 0;
  const bigs = (statusRows ?? []).filter(r => r.role === 'big');
  const littles = (statusRows ?? []).filter(r => r.role === 'little');
  const bigsDone = bigs.filter(r => r.submitted).length;
  const littlesDone = littles.filter(r => r.submitted).length;

  // "Needs attention" means exactly that: things blocked on the admin,
  // most-blocking first. Progress meters are ambient status and live
  // below, not here — a half-full bar isn't a task.
  const rosterSize = bigs.length + littles.length;
  const outstanding = rosterSize - (bigsDone + littlesDone);
  const pairingsRun = (reveal?.total ?? 0) > 0;
  const unrevealed = reveal?.unnotifiedBigs ?? ((reveal?.total ?? 0) - (reveal?.sent ?? 0));
  const recipientUnit = reveal?.unnotifiedBigs === undefined ? 'pairing' : 'Big';

  const attention: { tone: 'urgent' | 'waiting' | 'ready'; title: string; detail: string; action: string; to: string }[] = [];
  if (isAdmin && !cycleId) {
    attention.push({ tone: 'ready', title: 'No active matching cycle', detail: 'Start a cycle before members can submit rankings.', action: 'Open cycle settings', to: '/group/settings' });
  }
  if (pendingCount > 0) {
    attention.push({
      tone: 'urgent',
      title: `${pendingCount} join request${pendingCount === 1 ? '' : 's'} waiting`,
      detail: `${pendingCount === 1 ? 'Someone' : 'They'} can't rank until you approve ${pendingCount === 1 ? 'them' : 'them'}.`,
      action: `Approve ${pendingCount} ${pendingCount === 1 ? 'member' : 'members'}`,
      to: '/group/approvals',
    });
  }
  if (rosterSize > 0 && outstanding > 0) {
    attention.push({
      tone: 'waiting',
      title: `${outstanding} of ${rosterSize} haven't submitted rankings`,
      detail: 'You can still run matching — they’ll count as having no preferences.',
      action: 'View submissions',
      to: '/group/status',
    });
  }
  if (rosterSize > 0 && outstanding === 0 && !pairingsRun && revealReady) {
    attention.push({
      tone: 'ready',
      title: 'Everyone has submitted',
      detail: 'Your chapter is ready to match.',
      action: 'Run matching',
      to: '/group/status',
    });
  }
  const deliveryWarning = revealDeliveryWarning(reveal);
  if (deliveryWarning) {
    attention.unshift({ tone: 'urgent', title: 'Reveal delivery needs attention', detail: deliveryWarning, action: 'Review delivery', to: '/group/pairings' });
  }
  if (SHOW_MATCHING_EMAIL_TOOLS && !deliveryWarning && pairingsRun && unrevealed > 0) {
    attention.push({
      tone: 'ready',
      title: `${unrevealed} ${recipientUnit}${unrevealed === 1 ? '' : 's'} not notified yet`,
      detail: 'Pairings are ready to reveal by email.',
      action: 'Reveal',
      to: '/group/pairings',
    });
  }

  const toneDot: Record<'urgent' | 'waiting' | 'ready', string> = {
    urgent: 'bg-brick-500',
    waiting: 'bg-gold-400',
    ready: 'bg-[color:var(--ss-jade)]',
  };

  return (
    <div>
      <Heading text="Overview" />
      <div className="ss-overview-sections">
        {isAdmin && (
          <section className="ss-admin-attention flex flex-col gap-3" aria-label="Chapter tasks">
            <div className="flex items-center gap-2">
              <SectionHeading>Needs attention</SectionHeading>
              {attention.length > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-badge bg-brick-500 px-1.5 text-[11px] font-semibold text-white tabular-nums">
                  {attention.length}
                </span>
              )}
            </div>
            {attention.length === 0 && <SectionHeading>
              {chapterLoading ? 'Loading chapter status…' : (statusError || pendingError || revealError) && attention.length === 0
                ? 'Chapter status unavailable'
                : rosterSize === 0 && attention.length === 0
                ? 'Nothing here yet'
                : attention.length === 0
                  ? 'You’re all caught up'
                  : 'What needs you'}
            </SectionHeading>}

            {!!revealError && <div role="alert"><p className="ss-caption">Pairing status is unavailable.</p><Button variant="quiet" size="sm" className="mt-2" onClick={() => void retryReveal()}>Retry pairing status</Button></div>}
            {!!pendingError && <div role="alert"><p className="ss-caption">Join request counts are unavailable.</p><Button variant="quiet" size="sm" className="mt-2" onClick={() => void retryPending()}>Retry join requests</Button></div>}
            {!!statusError && <div role="alert">
              <p className="ss-caption">Could not load chapter submissions. Submission counts are unavailable until this loads.</p>
              <Button variant="quiet" size="sm" className="mt-2" onClick={() => void retryStatus()}>Retry submissions</Button>
            </div>}
            {chapterLoading && attention.length === 0 ? <p role="status" className="ss-caption">Checking join requests, submissions, and pairings…</p> : (statusError || pendingError || revealError) && attention.length === 0 ? null : rosterSize === 0 && attention.length === 0 ? (
              <p className="ss-caption">
                No Bigs or Littles approved yet — once people join with your chapter code, their
                requests show up here.
              </p>
            ) : attention.length === 0 ? (
              <p className="ss-caption">
                {pairingsRun
                  ? 'Nothing is waiting on you right now. Pairings are matched and every Big has been notified.'
                  : 'Nothing is waiting on you right now.'}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {attention.map((item, index) => (
                  // Stacked, not title-beside-button: this card sits in a
                  // half-width dashboard column (~390px), where a side-by-side
                  // action squeezes the copy to one word per line.
                  <li key={item.title} className="flex items-start gap-2.5 py-3 first:pt-1">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.tone]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[color:var(--ss-ink-2)]">{item.title}</p>
                      <p className="ss-caption mt-0.5">{item.detail}</p>
                      <Button
                        size="sm"
                        variant={index === 0 ? 'primary' : 'outline'}
                        className="mt-2"
                        onClick={() => onNavigate(item.to)}
                      >
                        {item.action}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {rosterSize > 0 && (
              <div className="mt-1 pt-3 border-t border-[color:var(--ss-surface-border)] flex flex-col gap-2">
                <div className="ss-kicker" style={{ marginBottom: 0 }}>Chapter progress</div>
                <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                  <span>Bigs</span>
                  <span className="tabular-nums">
                    {bigsDone} / {bigs.length} submitted
                  </span>
                </div>
                <div className="ss-meter">
                  <span style={{ width: `${percent(bigsDone, bigs.length)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                  <span>Littles</span>
                  <span className="tabular-nums">
                    {littlesDone} / {littles.length} submitted
                  </span>
                </div>
                <div className="ss-meter">
                  <span style={{ width: `${percent(littlesDone, littles.length)}%` }} />
                </div>
              </div>
            )}

            <div className="mt-1 pt-3 border-t border-[color:var(--ss-surface-border)] flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onNavigate('/group/status?view=rankings')}>
                View member rankings
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate('/dashboard?tab=organization')}>
                Manage organization
              </Button>
            </div>
          </section>
        )}
        {isRanker && (
          <section className={`ss-ranking-overview ${isAdmin ? 'ss-ranking-overview-secondary' : ''}`} aria-label="Your ranking status">
            <div>
              <SectionHeading>{excluded ? 'Not participating this cycle' : !cycleId ? 'Rankings not open yet' : rankingError ? 'Ranking status unavailable' : rankingPending ? 'Loading your ranking…' : deadlineClosed ? 'Rankings closed' : submitted ? 'Rankings submitted' : 'Rankings open'}</SectionHeading>
              <p className="ss-caption mt-2">
                {excluded ? 'Your chapter membership and saved rankings are unchanged.' : !cycleId ? 'Your admin hasn’t started a matching cycle yet.' : rankingError ? 'Your saved choices have not been changed.' : rankingPending ? 'Checking your saved choices.' : submitted
                  ? `You’ve submitted ${rankedIds!.length} ${rankedIds!.length === 1 ? 'choice' : 'choices'}. ${deadlineClosed ? 'Your list is now read-only.' : 'You can edit and resubmit until the deadline.'}`
                  : deadlineClosed ? 'The deadline has passed. You can still view your list.' : `Rank at least ${minimum} ${targetPlural}, most preferred first.`}
              </p>
              <span className="ss-pill w-fit mt-4">Deadline: {formatRankingDeadline(membership.group)}</span>
            </div>
            <div className="ss-ranking-overview-action">
              {rankingError ? <Button variant="outline" onClick={() => void retryRanking()}>Retry ranking status</Button> : <Button variant={isAdmin ? 'outline' : 'primary'} disabled={excluded || !cycleId || rankingPending} onClick={() => onNavigate('/group/submit-ranking')}>
                {deadlineClosed ? 'View ranking' : submitted ? 'Edit ranking' : 'Start ranking'}
              </Button>}
            </div>
          </section>
        )}
        {membership.role === 'admin' && <ChooseMatchingRole />}
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------
// Rankings tab — real numbered list, matching the design's tour preview
// ---------------------------------------------------------------------------

const RankingsTab = ({
  membership,
  onNavigate,
}: {
  membership: MembershipWithGroup;
  onNavigate: (p: string) => void;
}) => {
  const { user } = useAuth();
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const target = opposite(membership.role);
  const targetPlural = target === 'big' ? 'Bigs' : 'littles';
  const cycleId = membership.group.active_cycle_id;
  const participation = useCycleParticipation(user?.id ?? '', membership.group_id, cycleId);
  const excluded = participation.data?.excludedIds.includes(user?.id ?? '') ?? false;

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids, error }) => { if (error) throw new Error(error); return ids; }),
    enabled: isRanker && !!cycleId,
  });

  const { data: roster } = useQuery({
    queryKey: queryKeys.fullRoster(user?.id ?? '', membership.group_id),
    queryFn: () => getFullRoster(membership.group_id).then(({ roster: r, error }) => { if (error) throw new Error(error); return r; }),
    enabled: isRanker,
    staleTime: STALE.medium,
  });

  // Join ranked ids against roster so we can show real names in the list —
  // the design's preview shows names, not opaque user ids.
  const rankedList = useMemo(() => {
    if (!rankedIds || !roster) return [];
    const byId = new Map(roster.map(r => [r.userId, r] as const));
    return rankedIds
      .map(id => byId.get(id))
      .filter((r): r is RosterEntry => !!r);
  }, [rankedIds, roster]);

  if (excluded) return <div><Heading text="Rankings" /><p className="ss-caption mt-6">You’re not participating in this cycle. Your chapter membership and saved rankings are unchanged. Contact your chapter admin with questions.</p></div>;

  if (!isRanker) {
    return (
      <div>
        <Heading text="Rankings" />
        <Sub text="Submit your own preferences while keeping your admin access." />
        <div className="mt-6">
          <Button onClick={() => onNavigate('/group/submit-ranking')}>Set up my rankings</Button>
        </div>
      </div>
    );
  }

  const empty = rankedList.length === 0;

  return (
    <div>
      <Heading text={`My ${targetPlural.toLowerCase()} rankings`} />
      <Sub
        text={
          empty
            ? `Your list starts here. Rank the ${targetPlural.toLowerCase()} you've met when you're ready.`
            : 'You can reopen your list any time before the deadline.'
        }
      />

      <div className="mt-8 ss-surface">
        {empty ? (
          <>
            <SectionHeading>
              No rankings yet.
            </SectionHeading>
            <p className="ss-caption mt-2">
              Member eligibility, minimum rankings, and deadline are set by your chapter admin.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>Start ranking</Button>
              <Button variant="outline" onClick={() => onNavigate('/group/roster')}>
                See the chapter roster
              </Button>
            </div>
          </>
        ) : (
          <>
            <SectionHeading>
              My {targetPlural.toLowerCase()} rankings
            </SectionHeading>
            <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
              {rankedList.map((r, i) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-3 py-3 text-[color:var(--ss-ink-2)]"
                >
                  <span className="w-6 text-right text-[color:var(--ss-ink-5)] tabular-nums">
                    {i + 1}
                  </span>
                  <Avatar src={r.avatarUrl} name={r.name} email={r.email} size="sm" />
                  <span className="min-w-0 truncate">{r.name ?? r.email}</span>
                </div>
              ))}
            </div>
            <p className="ss-caption mt-4">
              Ranking deadline: {formatRankingDeadline(membership.group)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>Update rankings</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Roster tab — real member list with role pills
// ---------------------------------------------------------------------------

export const RosterTab = ({ membership, onNavigate }: {
  membership: MembershipWithGroup;
  onNavigate: (path: string) => void;
}) => <RosterContent membership={membership} onNavigate={onNavigate} embedded />;

// ---------------------------------------------------------------------------
// FAQ tab — the design's summarized preview; full FAQ lives at /faq
// ---------------------------------------------------------------------------

const FaqTab = () => (
  <div>
    <Heading text="A little help, whenever you need it." />
    <Sub text="Visit the FAQ whenever you need help with rankings, submissions, or what happens next." />
    <div className="mt-8 ss-surface">
      <SectionHeading>
        Frequently asked questions
      </SectionHeading>
      <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
        {[
          { question: 'Can I update my rankings?', answer: 'Yes. Open the Rankings tab and save your updated preferences while submissions are open. Your chapter admin controls the deadline and when submissions close.' },
          { question: 'Who can see my preferences?', answer: 'When Blind rankings is on, only you can view your preferences. When it is off, chapter admins can also access them. Your ranking page shows the current setting. Other members cannot see your preferences.' },
          { question: 'When will matches be announced?', answer: 'Your chapter admin runs matching and shares the results. Contact your admin for your chapter’s announcement date.' },
        ].map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[color:var(--ss-ink-2)] [&::-webkit-details-marker]:hidden">
              {question}
              <span aria-hidden="true" className="shrink-0 text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="ss-caption pb-4 pr-6">{answer}</p>
          </details>
        ))}
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        to="/faq"
        className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-control bg-[color:var(--ss-jade-deep)] text-white hover:bg-[color:var(--ss-jade)] transition-colors"
      >
        Open the full FAQ
      </Link>
      <Link
        to="/contact"
        className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-control border border-[color:var(--ss-jade-line)] text-[color:var(--ss-ink-2)] hover:bg-[color:var(--ss-button-hover)] transition-colors"
      >
        Contact us
      </Link>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export const OrganizationTab = ({ membership, onNavigate }: {
  membership: MembershipWithGroup;
  onNavigate: (path: string) => void;
}) => {
  const { user } = useAuth();
  const { data: pendingCount, isError } = useQuery({
    queryKey: queryKeys.pendingCount(user?.id ?? '', membership.group_id),
    queryFn: () => getPendingMemberships(membership.group_id).then(({ memberships, error }) => {
      if (error) throw new Error(error);
      return memberships.length;
    }),
    enabled: isEffectiveAdmin(membership),
    staleTime: STALE.short,
  });
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [copyError, setCopyError] = useState('');
  const joinCode = membership.group.join_code;
  const joinLink = `${window.location.origin}/login?join=${encodeURIComponent(joinCode)}`;
  const copyInvite = async (kind: 'code' | 'link') => {
    setCopied(null);
    setCopyError('');
    try {
      await navigator.clipboard.writeText(kind === 'code' ? joinCode : joinLink);
      setCopied(kind);
    } catch {
      setCopyError('Could not copy. Select and copy the code or link below.');
    }
  };
  if (!isEffectiveAdmin(membership)) return null;
  return <div>
    <Heading text="Your organization" />
    <Sub text="Manage your chapter’s matching, membership, and settings." />
    {membership.role === 'admin' && <ChooseMatchingRole />}
    <section className="mt-6 rounded-2xl border border-[color:var(--ss-surface-border)] bg-white/40 p-5" aria-label="Invite members">
      <SectionHeading>Invite members</SectionHeading>
      <p className="mt-2 text-sm text-[color:var(--ss-ink-3)]">Share this code or join link so members can request to join your chapter.</p>
      <p className="ss-label mt-5">Join code</p>
      <code className="mt-2 block select-all break-all font-mono text-3xl sm:text-4xl tracking-widest text-[color:var(--ss-ink-1)]">{joinCode}</code>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => copyInvite('code')}>Copy join code</Button>
        <Button variant="outline" size="sm" onClick={() => copyInvite('link')}>Copy join link</Button>
      </div>
      <p className="ss-label mt-4">Join link</p>
      <p className="mt-1 break-all select-all text-sm text-[color:var(--ss-ink-3)]">{joinLink}</p>
      {copied && <p role="status" className="ss-caption mt-2">{copied === 'code' ? 'Join code copied.' : 'Join link copied.'}</p>}
      {copyError && <p role="alert" className="mt-2 text-sm text-[color:var(--ss-error)]">{copyError}</p>}
    </section>
    <div className="grid gap-4 sm:grid-cols-2 mt-6">
      {[
        { title: 'Submissions', description: 'Track who has ranked and get your chapter ready to match.', action: 'View submissions', path: '/group/status' },
        { title: 'Member rankings', description: (membership.group.blind_rankings ?? true) ? 'Blind rankings are on. Open this page to review privacy settings and submission status.' : 'Review each Big or Little’s submitted preferences in order.', action: 'View member rankings', path: '/group/status?view=rankings' },
        { title: 'Pairings', description: 'Review matches and make adjustments.', action: 'View pairings', path: '/group/pairings' },
      ].map(item => <section key={item.path} className="rounded-2xl border border-[color:var(--ss-surface-border)] bg-white/40 p-5 flex flex-col gap-3">
        <SectionHeading>{item.title}</SectionHeading>
        <p className="text-sm text-[color:var(--ss-ink-3)] flex-1">{item.description}</p>
        <Button variant="outline" className="self-start" onClick={() => onNavigate(item.path)}>{item.action}</Button>
      </section>)}
    </div>
    <section className="mt-4 rounded-2xl border border-[color:var(--ss-surface-border)] p-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <SectionHeading>Approvals</SectionHeading>
          {pendingCount !== undefined && !isError && <span className="rounded-badge bg-white/60 px-2 py-0.5 text-sm" aria-label={`${pendingCount} pending approvals`}>{pendingCount}</span>}
        </div>
        <p className="mt-2 text-sm text-[color:var(--ss-ink-3)]">{isError ? 'Count unavailable. Open approvals to review requests.' : pendingCount === undefined ? 'Loading pending requests…' : pendingCount === 0 ? 'No requests waiting for review.' : 'Review requests so members can start ranking.'}</p>
      </div>
      <Button variant="quiet" size="sm" onClick={() => onNavigate('/group/approvals')}>Review approvals</Button>
    </section>

  </div>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, membership, setActiveGroupId } = useGroup();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tabFromUrl = (searchParams.get('tab') as TabId) || 'dashboard';
  const [tab, setTab] = useState<TabId>(tabFromUrl);

  useEffect(() => {
    if (tab !== tabFromUrl) setTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setActiveTab = (id: TabId) => {
    setTab(id);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  const onNavigate = (path: string) => {
    if (membership) setActiveGroupId(membership.group_id);
    navigate(path);
  };

  // Hover/focus on a tab pill prefetches that tab's data so the switch is
  // instant. Cheap when the user doesn't click (React Query dedupes and
  // respects the query's staleTime), noticeable when they do. We only
  // prefetch tabs that fetch their own data; FAQ is static.
  const prefetchTab = (id: TabId) => {
    if (!user || !membership) return;
    if (id === 'roster' || id === 'rankings') {
      queryClient.prefetchQuery({
        queryKey: queryKeys.fullRoster(user.id, membership.group_id),
        queryFn: () => getFullRoster(membership.group_id).then(({ roster: r, error }) => { if (error) throw new Error(error); return r; }),
        staleTime: STALE.medium,
      });
    }
  };

  if (searchParams.get('tab') === 'profile') return <Navigate to="/profile" replace />;

  if (membership && membership.status !== 'approved') {
    return <Navigate to="/group/pending" replace />;
  }

  // -----------------------------------------------------------------------
  // Empty state — signed in but not in any chapter
  // -----------------------------------------------------------------------
  if (memberships.length === 0 || !membership) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
        <section className="ss-frost w-full max-w-2xl rounded-panel bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-14 pt-8 pb-10 md:pt-10 md:pb-14 text-center">
          <PageHeader className="flex items-center justify-between mb-10">
            <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
              sorora
            </Link>
          </PageHeader>
          <Heading text="Your chapter starts here." />
          <Sub text="You're signed in but not part of a chapter yet. Join one with a code, or set yours up." />
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button size="lg" variant="outline" onClick={() => navigate('/login?mode=signup&path=join')}>
              Join a chapter
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login?mode=signup&path=create')}>
              Create a chapter
            </Button>
          </div>
          <p className="mt-6 ss-caption">
            Already requested to join?{' '}
            <Link to="/group/onboarding" className="underline underline-offset-4">
              Check your request status
            </Link>
            .
          </p>
        </section>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Signed-in member scene
  // -----------------------------------------------------------------------
  const headerContext = isEffectiveAdmin(membership)
    ? `${membership.group.name} · ${roleLabel(membership)}`
    : membership.group.name;

  const renderTab = () => {
    switch (tab) {
      case 'rankings':
        return <RankingsTab membership={membership} onNavigate={onNavigate} />;
      case 'roster':
        return <RosterTab membership={membership} onNavigate={onNavigate} />;
      case 'organization':
        return isEffectiveAdmin(membership)
          ? <OrganizationTab membership={membership} onNavigate={onNavigate} />
          : <Navigate to="/dashboard" replace />;
      case 'settings':
        return isEffectiveAdmin(membership) ? <Settings embedded /> : <Navigate to="/dashboard" replace />;
      case 'faq':
        return <FaqTab />;
      case 'dashboard':
      default:
        return (
          <DashboardTab
            membership={membership}
            onNavigate={onNavigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-4xl rounded-panel bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <MemberHeader contextLabel={headerContext} activeTab={tab} onSelect={setActiveTab} onPrefetch={prefetchTab} isAdmin={isEffectiveAdmin(membership)} />

        <div className="text-left">{renderTab()}</div>
      </section>
    </div>
  );
};

export default Dashboard;
