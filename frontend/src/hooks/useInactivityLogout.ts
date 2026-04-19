import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

// Déconnexion automatique après 2h sans interaction dans la fenêtre
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function useInactivityLogout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;

    const handleInactivity = async () => {
      try { await api.post('/auth/logout'); } catch {}
      logout();
      window.location.href = '/login';
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleInactivity, INACTIVITY_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [token, logout]);
}
