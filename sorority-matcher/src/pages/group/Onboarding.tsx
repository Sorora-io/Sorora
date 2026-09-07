import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { homeForRole } from '../../components/RequireGroupRole';
import AddOrganizationForm from '../../components/AddOrganizationForm';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Get started</h2>
        <AddOrganizationForm
          onCreated={(groupId) => {
            setActiveGroupId(groupId);
            navigate('/group/approvals');
          }}
          onJoined={(groupId) => {
            setActiveGroupId(groupId);
            navigate('/group/pending');
          }}
        />
      </div>
    </div>
  );
};

export default Onboarding;
