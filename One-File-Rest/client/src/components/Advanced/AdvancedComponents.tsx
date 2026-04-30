import React from 'react';
import { motion } from 'framer-motion';
import './AdvancedComponents.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
}

interface CardProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  hover?: boolean;
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export const AdvancedButton: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
}) => {
  return (
    <motion.button
      className={`adv-button adv-button-${variant} adv-button-${size}`}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
};

export const AdvancedCard: React.FC<CardProps> = ({ children, title, icon, hover = true }) => {
  return (
    <motion.div
      className="adv-card"
      whileHover={hover ? { y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' } : {}}
      transition={{ duration: 0.3 }}
    >
      {(title || icon) && (
        <div className="adv-card-header">
          {icon && <div className="adv-card-icon">{icon}</div>}
          {title && <h3 className="adv-card-title">{title}</h3>}
        </div>
      )}
      <div className="adv-card-content">{children}</div>
    </motion.div>
  );
};

export const AdvancedBadge: React.FC<BadgeProps> = ({ children, variant = 'primary' }) => {
  return <span className={`adv-badge adv-badge-${variant}`}>{children}</span>;
};

export const AdvancedLoader: React.FC = () => {
  return (
    <div className="adv-loader">
      <motion.div
        className="adv-loader-spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};

export const AdvancedAlert: React.FC<{ type: 'success' | 'error' | 'warning' | 'info'; message: string }> = ({
  type,
  message,
}) => {
  return (
    <motion.div
      className={`adv-alert adv-alert-${type}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <span className="adv-alert-icon">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'warning' && '!'}
        {type === 'info' && 'ℹ'}
      </span>
      <span className="adv-alert-message">{message}</span>
    </motion.div>
  );
};

export const AdvancedModal: React.FC<{
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
}> = ({ isOpen, title, children, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      className="adv-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="adv-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adv-modal-header">
          <h2>{title}</h2>
          <button className="adv-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adv-modal-content">{children}</div>
        <div className="adv-modal-footer">
          <AdvancedButton variant="secondary" onClick={onClose}>
            Cancel
          </AdvancedButton>
          {onConfirm && (
            <AdvancedButton variant="primary" onClick={onConfirm}>
              Confirm
            </AdvancedButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const AdvancedProgressBar: React.FC<{ value: number; max?: number; color?: string }> = ({
  value,
  max = 100,
  color = '#3498db',
}) => {
  const percentage = (value / max) * 100;

  return (
    <div className="adv-progress-bar">
      <motion.div
        className="adv-progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

export const AdvancedTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="adv-tooltip-container" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <motion.div className="adv-tooltip" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          {text}
        </motion.div>
      )}
    </div>
  );
};
