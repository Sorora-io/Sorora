import {littlePreferenceLabel} from './littlePreference';
test.each([
  [true,2,false,'Up to 2 Littles (twins)'],
  [true,3,false,'Up to 3 Littles (triplets)'],
  [true,null,true,'Up to 2 Littles (twins)'],
  [true,null,false,'1 Little (saved/default)'],
  [false,null,false,'Not submitted — defaults to 1 Little'],
  [false,2,false,'Up to 2 Littles (twins)'],
])('uses the saved count/legacy flag without inferring from submission status', (submitted,wantedLittleCount,willingToTakeTwins,label)=>{
  expect(littlePreferenceLabel({role:'big',submitted,wantedLittleCount,willingToTakeTwins})).toBe(label);
});
test('capacity does not apply to Littles and absent server fields are not interpreted as No',()=>{
  expect(littlePreferenceLabel({role:'little',submitted:true,wantedLittleCount:3,willingToTakeTwins:true})).toBe('Not applicable');
  expect(littlePreferenceLabel({role:'big',submitted:true})).toBe('Unavailable');
});

test('chapter cap overrides saved triplets and legacy twins without increasing smaller choices', () => {
  expect(littlePreferenceLabel({role:'big',submitted:true,wantedLittleCount:3}, 2)).toBe('Up to 2 Littles (twins) — saved choice: 3; capped by chapter rules');
  expect(littlePreferenceLabel({role:'big',submitted:true,willingToTakeTwins:true}, 1)).toBe('1 Little — saved choice: 2; capped by chapter rules');
  expect(littlePreferenceLabel({role:'big',submitted:true,wantedLittleCount:2}, 3)).toBe('Up to 2 Littles (twins)');
});
