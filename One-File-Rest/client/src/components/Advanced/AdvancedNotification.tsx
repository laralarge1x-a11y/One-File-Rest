import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
  action?: { label: string; onClick: () => void };
}

const notificationConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-800 dark:text-green-200',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-800 dark:text-red-200',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-800 dark:text-amber-200',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-800 dark:text-blue-200',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
  },
};

export const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
  action,
}) => {
  const config = notificationConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: -20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 100, y: -20 }}
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 shadow-lg`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconColor} mt-0.5`} />

        <div className="flex-1">
          <h3 className={`font-semibold ${config.textColor}`}>{title}</h3>
          {message && (
            <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>{message}</p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-medium ${config.textColor} hover:opacity-80 transition-opacity`}
            >
              {action.label}
            </button>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onClose(id)}
          className={`flex-shrink-0 ${config.textColor} hover:opacity-70 transition-opacity`}
        >
          <X className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`mt-2 h-1 origin-left rounded-full ${config.iconColor}`}
        />
      )}
    </motion.div>
  );
};

interface NotificationContainerProps {
  notifications: NotificationProps[];
  onClose: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
  position = 'top-right',
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-2 max-w-md`}>
      <AnimatePresence>
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            {...notification}
            onClose={onClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = React.useState<NotificationProps[]>([]);

  const addNotification = (
    type: NotificationType,
    title: string,
    message?: string,
    duration?: number,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notification: NotificationProps = {
      id,
      type,
      title,
      message,
      duration,
      onClose: removeNotification,
      action,
    };
    setNotifications((prev) => [...prev, notification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const success = (title: string, message?: string, duration?: number) =>
    addNotification('success', title, message, duration);

  const error = (title: string, message?: string, duration?: number) =>
    addNotification('error', title, message, duration);

  const warning = (title: string, message?: string, duration?: number) =>
    addNotification('warning', title, message, duration);

  const info = (title: string, message?: string, duration?: number) =>
    addNotification('info', title, message, duration);

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
};
