import { HTMLAttributes } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AccountMenu from './AccountMenu';

const PageHeader = ({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) => {
  const { user } = useAuth();
  return (
    <header {...props} className={`flex flex-wrap items-center justify-between gap-x-5 gap-y-3 ${className}`}>
      {children}
      {user && <div className="ml-auto"><AccountMenu /></div>}
    </header>
  );
};
export default PageHeader;
