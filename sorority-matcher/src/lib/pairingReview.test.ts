import { reviewPairings } from './pairingReview';
import { RankingExport } from './rankingExport';
const pairs=[{bigId:'b',bigName:'Big',littleId:'l1',littleName:'Little 1'},{bigId:'b',bigName:'Big',littleId:'l2',littleName:'Little 2'}];
const rankings:RankingExport={chapter:'Chapter',cycle:'Fall',cycleId:'c',members:[
 {userId:'b',name:'Big',email:'',role:'big',submitted:true,updatedAt:null,preferences:[{rank:1,userId:'l1',name:null,email:null},{rank:2,userId:'l2',name:null,email:null}]},
 {userId:'l1',name:'Little 1',email:'',role:'little',submitted:true,updatedAt:null,preferences:[{rank:1,userId:'b',name:null,email:null}]},
 {userId:'l2',name:'Little 2',email:'',role:'little',submitted:true,updatedAt:null,preferences:[{rank:1,userId:'b',name:null,email:null}]},
]};
test('only both first choices qualify, including when a Big takes twins',()=>{
 const result=reviewPairings(pairs,rankings);
 expect(result.map(p=>p.mutualFirst)).toEqual([true,false]);
 expect(result[1]).toMatchObject({bigRank:2,littleRank:1,matchType:'Mutually ranked'});
});
test('one-sided, missing, and unsubmitted rankings cannot be mistaken for first choices',()=>{
 const copy:RankingExport=JSON.parse(JSON.stringify(rankings));copy.members[0].preferences=[];
 expect(reviewPairings(pairs,copy)[0]).toMatchObject({mutualFirst:false,bigRank:'Not ranked',matchType:'One-sided ranking'});
 copy.members[1].submitted=false;
 expect(reviewPairings(pairs,copy)[0]).toMatchObject({littleRank:'Not submitted',matchType:'Neither ranked the other — review'});
 copy.members=[];
 expect(reviewPairings(pairs,copy)[0]).toMatchObject({mutualFirst:false,matchType:'Rankings unavailable'});
});
