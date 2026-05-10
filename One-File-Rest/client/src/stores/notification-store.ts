import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  case_id?: number | null;
  action_url?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  items: Notification[];
  unread: number;
  socket: Socket | null;
  initSocket: (discordId: string) => () => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  setItems: (items: Notification[]) => void;
  setUnread: (n: number) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unread: 0,
  socket: null,

  initSocket: (discordId: string) => {
    const socket = io(window.location.origin, {
      reconnection: true,
      withCredentials: true,
    });
    set({ socket });

    socket.on('notification:new', (n: Notification) => {
      set((s) => ({
        items: [n, ...s.items].slice(0, 50),
        unread: s.unread + 1,
      }));
    });

    return () => {
      socket.disconnect();
      set({ socket: null });
    };
  },

  markRead: (id: number) => {
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
    fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    }).catch(() => {});
  },

  markAllRead: () => {
    const count = get().unread;
    set((s) => ({
      items: s.items.map((n) => ({ ...n, is_read: true })),
      unread: 0,
    }));
    if (count > 0) {
      fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    }
  },

  setItems: (items) => set({ items }),
  setUnread: (unread) => set({ unread }),
}));