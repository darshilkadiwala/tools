import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import './index.css';

import { ThemeProvider } from '@/components/ui/theme-provider';
import { ColorThemeProvider } from '@/contexts/ColorThemeContext';

import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    </ThemeProvider>
  </StrictMode>,
);
