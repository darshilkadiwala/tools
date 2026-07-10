import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled application error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className='flex min-h-[50vh] items-center justify-center p-6'>
          <div className='bg-destructive/10 border-destructive/20 max-w-lg space-y-4 rounded-lg border p-6 text-center'>
            <h1 className='text-lg font-semibold'>Something went wrong</h1>
            <p className='text-muted-foreground text-sm'>{this.state.error.message}</p>
            <Button
              onClick={() => {
                window.location.replace('/');
              }}>
              Return to loans
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
