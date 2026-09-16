import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGroup } from '../../contexts/GroupContext';
import { homeForRole } from '../../components/RequireGroupRole';
import { groupLabel } from '../../lib/groups';
import Button from '../../components/Button';
import SceneShell from '../../components/SceneShell';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Pending = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { membership, loading, refresh } = useGroup();

  useEffect(() => {
    if (loading) return;
    if (!membership) {
      navigate('/group/onboarding', { replace: true });
    } else if (membership.status === 'approved') {
      navigate(homeForRole(membership), { replace: true });
    }
  }, [loading, membership, navigate]);

  const rejected = membership?.status === 'rejected';

  return (
    <SceneShell
      topRightLabel="Sign out"
      onTopRight={() => signOut()}
      footer={
        <>
          <Button variant="outline" onClick={refresh}>
            Check again
          </Button>
        </>
      }
    >
      <span className="ss-kicker">Chapter membership</span>
      <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
        {rejected ? 'Request not approved.' : 'Waiting on your admin.'}
      </h1>
      <p className="mt-4 max-w-lg text-[color:var(--ss-ink-5)] text-base leading-relaxed">
        {rejected
          ? "Your request to join wasn't approved. Contact your chapter's admin if you think this is a mistake."
          : "We'll let you know as soon as your chapter admin reviews your request."}
      </p>
      {membership && (
        <div className="mt-6 ss-surface w-full max-w-md text-left">
          <div className="ss-kicker" style={{ marginBottom: 4 }}>You requested to join</div>
          <p className="text-[color:var(--ss-ink-1)] font-medium text-lg">
            {groupLabel(membership.group)}
          </p>
          <p className="ss-caption mt-1">
            As {roleLabel[membership.role] ?? membership.role}
          </p>
        </div>
      )}
    </SceneShell>
  );
};

export default Pending;
