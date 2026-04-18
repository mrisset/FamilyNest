import { create } from 'zustand';
import type { User } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const storedUser = localStorage.getItem('fn_user');
const storedToken = localStorage.getItem('fn_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken ?? null,

  setAuth: (user, token) => {
    localStorage.setItem('fn_user', JSON.stringify(user));
    localStorage.setItem('fn_token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('fn_user');
    localStorage.removeItem('fn_token');
    set({ user: null, token: null });
  },
}));
