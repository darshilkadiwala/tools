import { CalculatorIcon, Car, FileText, GraduationCap, Home, Plus, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLoanContext } from '@/contexts/LoanContext';
import { cn } from '@/lib/utils';

import type { Loan, LoanType } from '@/types';

const loanTypeIcons = {
  home: Home,
  car: Car,
  education: GraduationCap,
  personal: Wallet,
  other: FileText,
};

const loanTypeLabels: Record<LoanType, string> = {
  home: 'Home Loans',
  car: 'Car Loans',
  education: 'Education Loans',
  personal: 'Personal Loans',
  other: 'Other Loans',
};

const loanTypeOrder: LoanType[] = ['home', 'car', 'education', 'personal', 'other'];

function groupLoansByType(loans: Loan[]): Record<LoanType, Loan[]> {
  const grouped: Record<LoanType, Loan[]> = {
    home: [],
    car: [],
    education: [],
    personal: [],
    other: [],
  };

  loans.forEach((loan) => {
    grouped[loan.type].push(loan);
  });

  return grouped;
}

export function AppSidebar() {
  const { loans } = useLoanContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const groupedLoans = groupLoansByType(loans.loans);

  // Handle navigation and close sidebar on mobile
  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar variant='inset'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' onClick={() => handleNavigation('/')}>
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                <CalculatorIcon className='size-5' />
              </div>
              <div className='flex flex-1 items-center text-start text-sm leading-tight'>
                <span className='truncate font-medium'>Loans Calculator</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleNavigation('/loans/create')} className='w-full justify-start'>
                  <Plus className='h-4 w-4' />
                  <span>New Loan</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {loanTypeOrder.map((type) => {
          const typeLoans = groupedLoans[type];
          if (typeLoans.length === 0) return null;

          const Icon = loanTypeIcons[type];

          return (
            <SidebarGroup key={type}>
              <SidebarGroupLabel>{loanTypeLabels[type]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {typeLoans.map((loan) => {
                    const isActive = location.pathname === `/loans/${loan.id}`;
                    return (
                      <SidebarMenuItem key={loan.id}>
                        <SidebarMenuButton
                          onClick={() => handleNavigation(`/loans/${loan.id}`)}
                          className={cn('w-full justify-start', isActive && 'bg-accent text-accent-foreground')}>
                          <Icon className='h-4 w-4' />
                          <span className='truncate'>{loan.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
