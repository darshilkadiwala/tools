import type { ComponentProps, JSX } from 'react';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>): JSX.Element {
  return (
    <NextThemesProvider attribute='class' defaultTheme='system' enableSystem storageKey='emi-appearance' {...props}>
      {children}
    </NextThemesProvider>
  );
}
