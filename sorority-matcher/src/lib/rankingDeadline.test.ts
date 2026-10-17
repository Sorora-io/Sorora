import { rankingDeadlinePassed } from './rankingDeadline';
test('deadline includes the whole selected UTC day regardless of local timezone', () => {
  expect(rankingDeadlinePassed('2026-09-29',Date.parse('2026-09-29T23:59:59.999Z'))).toBe(false);
  expect(rankingDeadlinePassed('2026-09-29',Date.parse('2026-09-30T00:00:00Z'))).toBe(true);
  expect(rankingDeadlinePassed(null)).toBe(false);
});

import { parseDeadlineInput, deadlineInput, deadlineInstant, formatRankingDeadline, groupRankingDeadline } from './rankingDeadline';
test.each([
  ['2026-01-15T20:30','America/New_York','2026-01-16T01:30:00Z'],
  ['2026-07-15T20:30','America/New_York','2026-07-16T00:30:00Z'],
  ['2026-07-15T20:30','Asia/Kolkata','2026-07-15T15:00:00Z'],
  ['2026-07-15T20:30','Asia/Kathmandu','2026-07-15T14:45:00Z'],
  ['2026-07-15T00:00','Pacific/Auckland','2026-07-14T12:00:00Z'],
])('converts %s in %s accurately', (local,zone,instant) => {
  expect(parseDeadlineInput(local,zone)).toEqual({instant,error:null});
  expect(deadlineInput(instant,zone)).toBe(local);
});
test('requires an explicit named zone and rejects invalid dates and offsets', () => {
  expect(parseDeadlineInput('2026-07-15T20:30','').error).toMatch(/Choose a time zone/);
  expect(parseDeadlineInput('2026-02-30T20:30','America/New_York').error).not.toBeNull();
  expect(parseDeadlineInput('2026-07-15T20:30','Made/Up').error).not.toBeNull();
  expect(parseDeadlineInput('2026-07-15T20:30','-05:00').error).not.toBeNull();
  expect(parseDeadlineInput('','')).toEqual({instant:null,error:null});
});
test('rejects skipped and repeated daylight-saving times rather than choosing an offset', () => {
  expect(parseDeadlineInput('2026-03-08T02:30','America/New_York').error).toMatch(/does not exist/);
  expect(parseDeadlineInput('2026-11-01T01:30','America/New_York').error).toMatch(/occurs twice/);
  expect(parseDeadlineInput('2026-10-04T02:15','Australia/Lord_Howe').error).toMatch(/does not exist/);
});
test('legacy cutoffs are unchanged and exact instants close at the boundary', () => {
  expect(deadlineInstant('2026-09-29')).toBe('2026-09-30T00:00:00.000Z');
  const g={ranking_deadline:'2026-09-29',ranking_deadline_at:'2026-10-01T03:30:00Z',ranking_deadline_timezone:'America/New_York'};
  expect(groupRankingDeadline(g)).toBe(g.ranking_deadline_at);
  expect(rankingDeadlinePassed(groupRankingDeadline(g),Date.parse('2026-10-01T03:29:59.999Z'))).toBe(false);
  expect(rankingDeadlinePassed(groupRankingDeadline(g),Date.parse('2026-10-01T03:30:00Z'))).toBe(true);
  expect(formatRankingDeadline(g)).toContain('America/New_York');
  expect(formatRankingDeadline({ranking_deadline:'2026-09-29'})).toContain('UTC');
});


import { act, renderHook } from '@testing-library/react';
import { useRankingDeadline } from './rankingDeadline';
test('advancing clock does not cause a render loop without a deadline or with an expired one', () => {
  let tick = Date.parse('2026-10-16T12:00:00Z');
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => ++tick);
  let renders = 0;
  try {
    const hook = renderHook(({ deadline }: {deadline: string | null}) => {
      if (++renders > 10) throw Error('Deadline clock render loop');
      return useRankingDeadline(deadline);
    }, {initialProps: {deadline: null as string | null}});
    expect(hook.result.current).toBe(false);
    hook.rerender({deadline:'2020-01-01'});
    expect(hook.result.current).toBe(true);
    expect(renders).toBeLessThan(6);
    hook.unmount();
  } finally { clock.mockRestore(); }
});
test('deadline timer closes at the cutoff and responds to a changed deadline', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  try {
    const hook=renderHook(({deadline})=>useRankingDeadline(deadline),{initialProps:{deadline:'2026-10-16T12:00:01Z'}});
    expect(hook.result.current).toBe(false);
    act(()=>{jest.advanceTimersByTime(1000);});
    expect(hook.result.current).toBe(true);
    hook.rerender({deadline:'2026-10-16T12:00:02Z'});
    expect(hook.result.current).toBe(false);
    act(()=>{jest.advanceTimersByTime(1000);});
    expect(hook.result.current).toBe(true);
    hook.unmount();
  } finally { jest.useRealTimers(); }
});
