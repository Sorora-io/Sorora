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
