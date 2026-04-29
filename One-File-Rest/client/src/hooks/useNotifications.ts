import { useState, useCallback } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const notification: Notification = { id, message, type, duration };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'success', duration);
  }, [addNotification]);

  const error = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'error', duration);
  }, [addNotification]);

  const warning = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'warning', duration);
  }, [addNotification]);

  const info = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'info', duration);
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
}
