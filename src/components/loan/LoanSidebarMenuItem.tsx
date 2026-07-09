import type { JSX } from 'react';

import { CalendarDays, MoreHorizontal, Pencil, Trash2, type LucideIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

import type { Loan } from '@/types';

interface LoanSidebarMenuItemProps {
  loan: Loan;
  icon: LucideIcon;
  isActive: boolean;
  onView: (loanId: string) => void;
  onEdit: (loanId: string) => void;
  onDelete: (loan: Loan) => void;
}

export function LoanSidebarMenuItem({
  loan,
  icon: Icon,
  isActive,
  onView,
  onEdit,
  onDelete,
}: LoanSidebarMenuItemProps): JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={loan.name}
        onClick={() => {
          onView(loan.id);
        }}>
        <Icon className='size-4' />
        <span className='truncate'>{loan.name}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal className='size-4' />
            <span className='sr-only'>Open actions for {loan.name}</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' className='w-44'>
          <DropdownMenuItem
            onClick={() => {
              onView(loan.id);
            }}>
            <CalendarDays className='size-4' />
            View schedule
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onEdit(loan.id);
            }}>
            <Pencil className='size-4' />
            Edit loan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => {
              onDelete(loan);
            }}>
            <Trash2 className='size-4' />
            Delete loan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
