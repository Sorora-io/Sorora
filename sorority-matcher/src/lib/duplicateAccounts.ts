export interface ChapterAccountName {
  userId:string; groupId:string; name:string|null|undefined; email?:string|null; status:string;
}
export function findDuplicateNames(groupId:string, accounts:ChapterAccountName[]) {
  const names=new Map<string,Map<string,ChapterAccountName>>();
  for(const account of accounts) {
    if(account.groupId!==groupId || !['pending','approved'].includes(account.status))continue;
    const name=account.name?.normalize('NFKC').trim().replace(/\s+/gu,' ');
    if(!name)continue;
    const key=name.toLowerCase();
    if(!names.has(key))names.set(key,new Map());
    names.get(key)!.set(account.userId,{...account,name});
  }
  return [...names.entries()].filter(([,people])=>people.size>1).map(([key,people])=>({
    key,name:[...people.values()][0].name!,accounts:[...people.values()],
  })).sort((a,b)=>a.name.localeCompare(b.name));
}
