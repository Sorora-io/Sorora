import { ChapterAccountName, findDuplicateNames } from '../lib/duplicateAccounts';
export default function DuplicateNameWarnings({groupId,accounts,isAdmin}:{groupId:string;accounts:ChapterAccountName[];isAdmin:boolean}) {
  if(!isAdmin)return null;
  const groups=findDuplicateNames(groupId,accounts);
  if(!groups.length)return null;
  return <section className="mt-6 ss-surface border border-amber-300" aria-label="Possible duplicate accounts">
    <h2 className="font-medium">Possible duplicate accounts ({groups.length})</h2>
    <p className="ss-caption mt-2">These accounts share a name in this chapter. Check the emails and confirm whether they belong to the same person. People can share a name; this warning does not block approval or merge accounts.</p>
    <ul className="mt-4 space-y-4">{groups.map(group=><li key={group.key}>
      <p className="font-medium text-sm">{group.name}</p>
      <ul className="mt-1 space-y-1 text-sm">{group.accounts.map(account=><li key={account.userId} className="break-words">{account.email || 'Email unavailable'} · {account.status==='pending'?'Pending request':'Approved member'}</li>)}</ul>
    </li>)}</ul>
  </section>;
}
