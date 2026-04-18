import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const stored = localStorage.getItem('fn_theme') as Theme | null;
const initial: Theme = stored ?? 'light';

// Apply immediately on module load (backup for no-FOUC inline script)
document.documentElement.classList.toggle('dark', initial === 'dark');

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggle: () => set(s => {
    const next = s.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('fn_theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    return { theme: next };
  }),
}));
