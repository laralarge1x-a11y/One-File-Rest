import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// ADVANCED THEME SYSTEM WITH DARK MODE
// ============================================================================

interface ThemeContextType {
  theme: 'light' | 'dark';
  accentColor: string;
  toggleTheme: () => void;
  setAccentColor: (color: string) => void;
  colors: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColor] = useState('blue');

  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = saved || (prefersDark ? 'dark' : 'light');

    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const colors = {
    primary: theme === 'light' ? '#3b82f6' : '#60a5fa',
    secondary: theme === 'light' ? '#8b5cf6' : '#a78bfa',
    success: theme === 'light' ? '#10b981' : '#34d399',
    warning: theme === 'light' ? '#f59e0b' : '#fbbf24',
    error: theme === 'light' ? '#ef4444' : '#f87171',
    background: theme === 'light' ? '#ffffff' : '#0f172a',
    foreground: theme === 'light' ? '#000000' : '#ffffff',
    border: theme === 'light' ? '#e5e7eb' : '#1e293b',
  };

  return (
    <ThemeContext.Provider value={{ theme, accentColor, toggleTheme, setAccentColor, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// ============================================================================
// ADVANCED BUTTON COMPONENT WITH ANIMATIONS
// ============================================================================

interface AdvancedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export const AdvancedButton: React.FC<AdvancedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = 'md',
  children,
  disabled,
  ...props
}) => {
  const { colors } = useTheme();

  const variantStyles = {
    primary: `bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg`,
    secondary: `bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg`,
    success: `bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg`,
    warning: `bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg`,
    error: `bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg`,
    ghost: `bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600`,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };

  const roundedStyles = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      disabled={disabled || isLoading}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${roundedStyles[rounded]}
        ${fullWidth ? 'w-full' : ''}
        font-semibold
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        flex
        items-center
        justify-center
        gap-2
        focus:outline-none
        focus:ring-2
        focus:ring-offset-2
        focus:ring-blue-500
      `}
      {...props}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span>{icon}</span>}
        </>
      )}
    </motion.button>
  );
};

// ============================================================================
// ADVANCED MODAL COMPONENT
// ============================================================================

interface AdvancedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const AdvancedModal: React.FC<AdvancedModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}) => {
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed inset-0 flex items-center justify-center z-50 pointer-events-none`}
          >
            <div className={`${sizeStyles[size]} bg-white dark:bg-gray-900 rounded-lg shadow-2xl pointer-events-auto`}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto">{children}</div>

              {/* Footer */}
              {onConfirm && (
                <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 justify-end">
                  <AdvancedButton variant="ghost" onClick={onClose} disabled={isLoading}>
                    {cancelText}
                  </AdvancedButton>
                  <AdvancedButton variant="primary" onClick={onConfirm} isLoading={isLoading}>
                    {confirmText}
                  </AdvancedButton>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// ADVANCED FORM INPUT WITH VALIDATION
// ============================================================================

interface AdvancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  success?: boolean;
}

export const AdvancedInput: React.FC<AdvancedInputProps> = ({
  label,
  error,
  helperText,
  icon,
  isLoading,
  success,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">{icon}</div>}

        <motion.input
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          animate={{
            borderColor: error ? '#ef4444' : success ? '#10b981' : isFocused ? '#3b82f6' : '#e5e7eb',
            boxShadow: isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
          }}
          className={`
            w-full
            px-4
            py-2
            ${icon ? 'pl-10' : ''}
            border-2
            rounded-lg
            transition-all
            duration-200
            focus:outline-none
            dark:bg-gray-800
            dark:text-white
            dark:border-gray-700
          `}
          {...props}
        />

        {isLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
          />
        )}

        {success && !isLoading && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500"
          >
            ✓
          </motion.div>
        )}

        {error && !isLoading && !success && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500"
          >
            ✕
          </motion.div>
        )}
      </div>

      {error && (
        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-sm mt-2">
          {error}
        </motion.p>
      )}

      {helperText && !error && (
        <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-gray-500 text-sm mt-2">
          {helperText}
        </motion.p>
      )}
    </div>
  );
};

// ============================================================================
// ADVANCED CARD COMPONENT WITH HOVER EFFECTS
// ============================================================================

interface AdvancedCardProps {
  children: ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
  className?: string;
  gradient?: boolean;
}

export const AdvancedCard: React.FC<AdvancedCardProps> = ({
  children,
  onClick,
  hoverable = true,
  className = '',
  gradient = false,
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -4, boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)' } : {}}
      onClick={onClick}
      className={`
        bg-white
        dark:bg-gray-800
        rounded-lg
        p-6
        transition-all
        duration-300
        ${hoverable ? 'cursor-pointer' : ''}
        ${gradient ? 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// ADVANCED BADGE COMPONENT
// ============================================================================

interface AdvancedBadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const AdvancedBadge: React.FC<AdvancedBadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
}) => {
  const variantStyles = {
    primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    secondary: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`
        inline-flex
        items-center
        gap-1
        rounded-full
        font-semibold
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.span>
  );
};

// ============================================================================
// ADVANCED LOADING SKELETON
// ============================================================================

interface SkeletonProps {
  count?: number;
  height?: string;
  width?: string;
  circle?: boolean;
}

export const AdvancedSkeleton: React.FC<SkeletonProps> = ({
  count = 1,
  height = 'h-4',
  width = 'w-full',
  circle = false,
}) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`
            bg-gray-200
            dark:bg-gray-700
            ${height}
            ${width}
            ${circle ? 'rounded-full' : 'rounded-md'}
          `}
        />
      ))}
    </div>
  );
};

// ============================================================================
// ADVANCED TOAST NOTIFICATION
// ============================================================================

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

export const AdvancedToast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-500 text-white',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 20, x: 20 }}
      className={`
        fixed
        bottom-4
        right-4
        px-6
        py-4
        rounded-lg
        shadow-lg
        flex
        items-center
        gap-3
        ${typeStyles[type]}
        z-50
      `}
    >
      <span className="text-xl">{icons[type]}</span>
      <span>{message}</span>
    </motion.div>
  );
};
