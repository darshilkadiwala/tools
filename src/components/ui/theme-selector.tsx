import type { JSX } from 'react';

import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button, ButtonGroup } from '@/components/ui/button';
import { appearanceModes, colorThemes } from '@/config/themes';
import { useColorTheme } from '@/contexts/ColorThemeContext';
import { useIsClient } from '@/hooks/useIsClient';
import { cn } from '@/lib/utils';

import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const appearanceIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function ThemeSelector(): JSX.Element {
  const { setTheme, resolvedTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <Button variant='ghost' size='icon-sm' disabled aria-label='Appearance settings'>
        <Palette className='size-4' />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label='Appearance settings' className='relative'>
          <Palette className='size-4' />
          <span
            className='ring-background bg-primary absolute end-0.5 bottom-0.5 size-2 rounded-full ring-2'
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-64 space-y-4 p-3'>
        <div className='space-y-2'>
          <Label className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>Mode</Label>
          <ButtonGroup className='w-full *:data-[slot=button]:flex-1'>
            {appearanceModes.map((mode) => {
              const Icon = appearanceIcons[mode.id];
              const isActive = resolvedTheme === mode.id;

              return (
                <Button
                  key={mode.id}
                  type='button'
                  size='sm'
                  variant={isActive ? 'default' : 'outline'}
                  aria-pressed={isActive}
                  aria-label={mode.label}
                  className='h-auto gap-1 py-2'
                  onClick={() => setTheme(mode.id)}>
                  <Icon className='size-4' />
                  <span className='text-xs'>{mode.label}</span>
                </Button>
              );
            })}
          </ButtonGroup>
        </div>

        <div className='space-y-2'>
          <Label className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>Color</Label>
          <div className='grid grid-cols-2 gap-2'>
            {colorThemes.map((themeOption) => {
              const isActive = colorTheme === themeOption.id;

              return (
                <button
                  key={themeOption.id}
                  type='button'
                  aria-pressed={isActive}
                  data-theme={themeOption.id}
                  onClick={() => setColorTheme(themeOption.id)}
                  className={cn(
                    resolvedTheme,
                    'hover:bg-muted flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors',
                    isActive ? 'border-primary bg-primary/10 ring-primary ring-1' : 'border-border bg-transparent',
                  )}>
                  <span
                    className={cn('bg-primary size-3.5 shrink-0 rounded-full')}
                    // style={{ backgroundColor: themeOption.swatch }}
                    aria-hidden
                  />
                  <span className='truncate'>{themeOption.label}</span>
                  {isActive ? <Check className='text-primary ms-auto size-3.5 shrink-0' /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
