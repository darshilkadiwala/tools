import { Link, Outlet, useLocation } from 'react-router-dom';

import { AppSidebar } from '@/components/AppSidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useLoanContext } from '@/contexts/LoanContext';
import { cn } from '@/lib/utils';

function getBreadcrumbs(pathname: string, loans: ReturnType<typeof useLoanContext>['loans']) {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; href?: string }> = [];

  if (paths.length === 0) {
    return [{ label: 'All Loans' }];
  }

  breadcrumbs.push({ label: 'All Loans', href: '/' });

  if (paths[0] === 'loans') {
    if (paths[1] === 'create') {
      breadcrumbs.push({ label: 'Create Loan' });
    } else if (paths[1]) {
      const loanId = paths[1];
      const loan = loans.loans.find((l) => l.id === loanId);

      if (paths[2] === 'edit') {
        breadcrumbs.push({
          label: loan?.name || 'Loan',
          href: `/loans/${loanId}`,
        });
        breadcrumbs.push({ label: 'Edit' });
      } else {
        breadcrumbs.push({ label: loan?.name || 'Loan Details' });
      }
    }
  }

  return breadcrumbs;
}

export function Layout() {
  const location = useLocation();
  const { loans } = useLoanContext();
  const breadcrumbs = getBreadcrumbs(location.pathname, loans);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header
          className={cn(
            'bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:rounded-t-xl',
          )}>
          <SidebarTrigger />
          <Separator orientation='vertical' className='me-1 data-[orientation=vertical]:h-4' />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className='flex items-center'>
                  {index > 0 && <BreadcrumbSeparator className='mx-2' />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className='container mx-auto max-w-7xl flex-1 p-4 md:p-6 lg:p-8'>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
