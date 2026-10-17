import { runDeferredAcceptance } from './matching';

test.each([1, 2, 3] as const)('respects a Big’s %i-Little limit', count => {
  const result = runDeferredAcceptance(['big'], ['a', 'b', 'c', 'd'],
    { big: ['d', 'c', 'b', 'a'] }, {}, new Set(), count === 1 ? {} : { big: count });
  expect(result).toEqual([{ big: 'big', littles: ['d', 'c', 'b', 'a'].slice(0, count) }]);
});

test('wanting three takes precedence over willingness to take twins', () => {
  expect(runDeferredAcceptance(['big'], ['a', 'b', 'c'], {}, {}, new Set(['big']), { big: 3 })[0].littles).toHaveLength(3);
});

test('willingness alone still allows two and never duplicates Littles', () => {
  const result = runDeferredAcceptance(['one', 'two'], ['a', 'b', 'c', 'd'], {}, {}, new Set(['one']));
  expect(result.find(r => r.big === 'one')?.littles).toHaveLength(2);
  const matched = result.flatMap(r => r.littles);
  expect(matched).toHaveLength(3);
  expect(new Set(matched).size).toBe(3);
});

test.each([1,2,3] as const)('organization maximum %i caps twins and triplet requests', maximum => {
 const result=runDeferredAcceptance(['a','b'], ['l1','l2','l3','l4','l5','l6'], {}, {}, new Set(['a']), {b:3}, maximum);
 expect(result.find(r=>r.big==='a')?.littles).toHaveLength(Math.min(2,maximum));
 expect(result.find(r=>r.big==='b')?.littles).toHaveLength(maximum);
});
