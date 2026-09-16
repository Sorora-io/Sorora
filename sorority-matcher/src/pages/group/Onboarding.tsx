import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { homeForRole } from '../../components/RequireGroupRole';
import AddOrganizationForm from '../../components/AddOrganizationForm';
import SceneShell from '../../components/SceneShell';

const Onboarding = () => {
  const navigate = useNavigate();
  const { membership, loading: groupLoading, setActiveGroupId } = useGroup();

  // Someone with an existing membership shouldn't see the create/join form
  // (e.g. they navigated here manually, or the auto-submit from signup
  // already ran) — send them to wherever they actually belong.
  useEffect(() => {
    if (groupLoading || !membership) return;
    navigate(membership.status === 'approved' ? homeForRole(membership) : '/group/pending', { replace: true });
  }, [groupLoading, membership, navigate]);

  return (
    <SceneShell topRightLabel={null}>
      <span className="ss-kicker">Add a chapter</span>
      <h1 className="font-display italic text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
        Your chapter starts here.
      </h1>
      <p className="mt-4 max-w-lg text-[color:var(--ss-ink-5)] text-base leading-relaxed">
        Joining an existing chapter, or setting yours up?
      </p>
      <div className="mt-8 w-full max-w-md ss-surface text-left">
        <AddOrganizationForm
          onCreated={groupId => {
            setActiveGroupId(groupId);
            navigate('/dashboard');
          }}
          onJoined={groupId => {
            setActiveGroupId(groupId);
            navigate('/group/pending');
          }}
        />
      </div>
    </SceneShell>
  );
};

export default Onboarding;
