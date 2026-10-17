import { useNavigate } from 'react-router-dom';
import Button from './Button';
import PageHeader from './PageHeader';

export type MemberTab = 'dashboard' | 'rankings' | 'roster' | 'faq' | 'organization' | 'settings';
const tabs: { id: MemberTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'rankings', label: 'My rankings' },
  { id: 'roster', label: 'Roster' },
  { id: 'organization', label: 'Organization' },
  { id: 'settings', label: 'Org Settings' },
];

export default function MemberHeader({ activeTab, onSelect, onPrefetch, showNavigation = true, isAdmin = false }: {
  activeTab?: MemberTab;
  onSelect?: (tab: MemberTab) => void;
  onPrefetch?: (tab: MemberTab) => void;
  showNavigation?: boolean;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  return <>
    <PageHeader className="mb-6">
      <Button variant="ghost" onClick={() => navigate('/')} className="ss-wordmark !p-0 !min-h-0 !text-2xl font-display italic !font-medium !text-[color:var(--ss-ink-1)]">sorora</Button>
    </PageHeader>
    {showNavigation && <>
      <nav aria-label="Dashboard navigation" className="flex flex-wrap gap-1 justify-center mb-4">
        {tabs.filter(tab => !['organization', 'settings'].includes(tab.id) || isAdmin).map(tab => <Button key={tab.id} variant="ghost" className="ss-tab !px-[22px] !py-[10px] !min-h-0 !border-0"
          onClick={() => onSelect ? onSelect(tab.id) : navigate(`/dashboard?tab=${tab.id}`)}
          onMouseEnter={() => onPrefetch?.(tab.id)} onFocus={() => onPrefetch?.(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}>{tab.label}</Button>)}
      </nav>
      <div className="ss-tab-underline mb-8" />
    </>}
  </>;
}
