import LoadingLogo from './LoadingLogo';

const LoadingScreen = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3">
    <LoadingLogo size={48} />
    <p className="text-sm text-gray-400">{label}</p>
  </div>
);

export default LoadingScreen;
