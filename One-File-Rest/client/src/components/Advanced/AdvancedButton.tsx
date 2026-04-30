import React from 'react';
import { motion } from 'framer-motion';
import './AdvancedButton.css';

interface AdvancedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const AdvancedButton: React.FC<AdvancedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}) => {
  return (
    <motion.button
      className={`advanced-btn advanced-btn-${variant} advanced-btn-${size} ${fullWidth ? 'full-width' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {loading && <span className="btn-spinner"></span>}
      {icon && <span className="btn-icon">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
};

export default AdvancedButton;
