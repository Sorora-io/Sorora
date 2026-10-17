import {render,screen} from '@testing-library/react';
import DuplicateNameWarnings from './DuplicateNameWarnings';
const accounts=[{userId:'a',groupId:'g',name:'Avery Chen',email:'first@example.com',status:'approved'},{userId:'b',groupId:'g',name:'avery chen',email:'second@example.com',status:'pending'}];
test('admins can review names and distinct emails without an automatic action',()=>{
 render(<DuplicateNameWarnings groupId="g" accounts={accounts} isAdmin/>);
 expect(screen.getByRole('heading',{name:'Possible duplicate accounts (1)'})).toBeInTheDocument();
 expect(screen.getByText('first@example.com · Approved member')).toBeInTheDocument();
 expect(screen.getByText('second@example.com · Pending request')).toBeInTheDocument();
 expect(screen.getByText(/does not block approval or merge accounts/)).toBeInTheDocument();
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('ordinary members never see the duplicate-account warning',()=>{
 render(<DuplicateNameWarnings groupId="g" accounts={accounts} isAdmin={false}/>);
 expect(screen.queryByRole('region',{name:'Possible duplicate accounts'})).not.toBeInTheDocument();
 expect(screen.queryByText(/first@example.com/)).not.toBeInTheDocument();
});
