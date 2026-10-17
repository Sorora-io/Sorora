import {findDuplicateNames} from './duplicateAccounts';
const person=(userId:string,name:string|null,groupId='g',status='approved')=>({userId,name,groupId,status,email:`${userId}@example.com`});
test('same-chapter names match across case, repeated spaces and pending/approved accounts',()=>{
 const result=findDuplicateNames('g',[person('a','  Avery  Chen '),person('b','avery chen','g','pending'),person('c','Different Name')]);
 expect(result).toHaveLength(1);expect(result[0].accounts.map(a=>a.userId)).toEqual(['a','b']);
});
test('other chapters, rejected requests, missing names and repeated records of one account do not create warnings',()=>{
 expect(findDuplicateNames('g',[person('a','Avery Chen'),person('a','Avery Chen'),person('b','Avery Chen','other'),person('c','Avery Chen','g','rejected'),person('d',null),person('e','  ')])).toEqual([]);
});
test('different names are not guessed to be the same person',()=>{
 expect(findDuplicateNames('g',[person('a','Alex Lee'),person('b','Alex Li'),person('c','Alex Lée')])).toEqual([]);
});
