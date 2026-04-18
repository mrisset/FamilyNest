import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fn_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const url: string = err.config?.url ?? '';
      // Ces routes utilisent 401 comme erreur métier (mauvais credentials)
      // → on ne redirige pas, on laisse onError gérer
      const isCredentialRoute =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/me/password') ||
        url.includes('/me');

      if (!isCredentialRoute) {
        localStorage.removeItem('fn_token');
        localStorage.removeItem('fn_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface House {
  id: string;
  name: string;
  description?: string;
  address?: string;
  coverPhotoUrl?: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export type ChannelFlag = 'discussion' | 'problem' | 'maintenance' | 'announcement' | 'other';

export interface Channel {
  id: string;
  houseId: string;
  name: string;
  flag: ChannelFlag;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  sentAt: string;
  author: { id: string; displayName: string; avatarUrl?: string };
}

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Reservation {
  id: string;
  houseId: string;
  startDate: string;
  endDate: string;
  guestCount?: number;
  notes?: string;
  rejectionReason?: string;
  status: ReservationStatus;
  createdAt: string;
  requestedByUser: User;
  reviewedByUser?: User;
}

export interface HouseDetail extends House {
  richDescription?: string;
  myRole: 'owner' | 'admin' | 'member';
  members: Array<{ id: string; role: 'owner' | 'admin' | 'member'; user: User; joinedAt: string }>;
  channels: Channel[];
}

export const FLAG_LABELS: Record<ChannelFlag, string> = {
  discussion: 'Discussion',
  problem: 'Problème',
  maintenance: 'Maintenance',
  announcement: 'Annonce',
  other: 'Autre',
};

export const FLAG_COLORS: Record<ChannelFlag, string> = {
  discussion: 'bg-blue-50 text-blue-700',
  problem: 'bg-red-50 text-red-700',
  maintenance: 'bg-orange-50 text-orange-700',
  announcement: 'bg-amber-50 text-amber-700',
  other: 'bg-stone-100 text-stone-600',
};

export const FLAG_ICONS: Record<ChannelFlag, string> = {
  discussion: '💬',
  problem: '🔧',
  maintenance: '🛠️',
  announcement: '📢',
  other: '•',
};
