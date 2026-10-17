import {render,screen,fireEvent} from '@testing-library/react';
import {useState} from 'react';
import MemberRankingPicker from './MemberRankingPicker';
const members:any[]=[{userId:'a',name:'Alex',email:'alex@example.com',role:'big'},{userId:'b',name:'Alex',email:'other@example.com',role:'little'},{userId:'c',name:'Beth',email:'beth@example.com',role:'little'}];
const Picker=()=>{const [id,setId]=useState('');return <><MemberRankingPicker members={members} value={id} onChange={setId}/><p>Selected:{id}</p><button>Outside</button></>;};
test('searches within the dropdown by name, email and role and retains selection',()=>{
 render(<Picker/>);fireEvent.click(screen.getByLabelText('Member'));
 const input=screen.getByRole('combobox',{name:'Search members'});expect(input).toHaveFocus();
 fireEvent.change(input,{target:{value:'other@example'}});expect(screen.getAllByRole('option')).toHaveLength(1);
 fireEvent.click(screen.getByRole('option',{name:/other@example/}));expect(screen.getByText('Selected:b')).toBeInTheDocument();expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(screen.getByLabelText('Member')).toHaveFocus();
 fireEvent.click(screen.getByLabelText('Member'));fireEvent.change(screen.getByRole('combobox'),{target:{value:'big'}});expect(screen.getAllByRole('option')).toHaveLength(1);
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'not-found'}});expect(screen.getByRole('status')).toHaveTextContent('No members found');
 fireEvent.click(screen.getByRole('button',{name:'Clear search'}));expect(screen.getAllByRole('option')).toHaveLength(3);expect(screen.getByText('Selected:b')).toBeInTheDocument();
});
test('keyboard arrows, Home, End, Enter and Escape work without accidental selection',()=>{
 render(<Picker/>);const trigger=screen.getByLabelText('Member');fireEvent.keyDown(trigger,{key:'ArrowDown'});
 const input=screen.getByRole('combobox');fireEvent.keyDown(input,{key:'End'});expect(input.getAttribute('aria-activedescendant')).toMatch(/option-2$/);
 fireEvent.keyDown(input,{key:'Home'});fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});expect(screen.getByText('Selected:b')).toBeInTheDocument();expect(trigger).toHaveFocus();
 fireEvent.keyDown(trigger,{key:'ArrowUp'});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Escape'});expect(screen.getByText('Selected:b')).toBeInTheDocument();expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(trigger).toHaveFocus();
});
test('clicking or tabbing outside closes the popup',()=>{
 render(<Picker/>);const trigger=screen.getByLabelText('Member');fireEvent.click(trigger);fireEvent.mouseDown(screen.getByRole('button',{name:'Outside'}));expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
 fireEvent.click(trigger);fireEvent.blur(screen.getByRole('combobox'),{relatedTarget:screen.getByRole('button',{name:'Outside'})});expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
