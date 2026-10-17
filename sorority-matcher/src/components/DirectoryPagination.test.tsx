import {render,screen,fireEvent} from '@testing-library/react';
import DirectoryPagination from './DirectoryPagination';
test('shows the actual result range and numbered current page',()=>{
 const change=jest.fn();render(<DirectoryPagination noun="accounts" offset={150} total={176} itemCount={26} loading={false} onPageChange={change}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Showing 151–176 of 176 accounts');
 expect(screen.getByRole('button',{name:'Page 4'})).toHaveAttribute('aria-current','page');
 expect(screen.getByRole('button',{name:'Next page of accounts'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Page 2'}));expect(change).toHaveBeenCalledWith(2);
 fireEvent.click(screen.getByRole('button',{name:'Previous page of accounts'}));expect(change).toHaveBeenLastCalledWith(3);
});
test('large directories have compact ellipses and validated direct page jumps',()=>{
 const change=jest.fn();render(<DirectoryPagination noun="organizations" offset={24950} total={50000} itemCount={50} loading={false} onPageChange={change}/>);
 expect(screen.getAllByText('…')).toHaveLength(2);expect(screen.getAllByRole('button',{name:/^Page /})).toHaveLength(5);
 expect(screen.getByRole('button',{name:'Page 500'})).toHaveAttribute('aria-current','page');
 const input=screen.getByLabelText('Go to page');fireEvent.change(input,{target:{value:'123'}});fireEvent.submit(input.closest('form')!);expect(change).toHaveBeenCalledWith(123);
 fireEvent.change(input,{target:{value:'1001'}});fireEvent.submit(input.closest('form')!);expect(screen.getByRole('alert')).toHaveTextContent('Choose a page from 1 to 1000');expect(change).toHaveBeenCalledTimes(1);
});
test('loading cannot navigate or claim a stale result range',()=>{
 render(<DirectoryPagination noun="accounts" offset={50} total={500} itemCount={50} loading onPageChange={jest.fn()}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Loading page 2');expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
 for(const button of screen.getAllByRole('button'))expect(button).toBeDisabled();
});
test('empty or single-page results do not present meaningless pagination controls',()=>{
 const {rerender}=render(<DirectoryPagination noun="accounts" offset={0} total={0} itemCount={0} loading={false} onPageChange={jest.fn()}/>);
 expect(screen.getByRole('status')).toHaveTextContent('0 accounts');expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
 rerender(<DirectoryPagination noun="accounts" offset={0} total={17} itemCount={17} loading={false} onPageChange={jest.fn()}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Showing 1–17 of 17 accounts');expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
