/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

export const a11y = {
  /**
   * Generate unique IDs for form labels and inputs
   */
  generateId: (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Create accessible button with proper ARIA attributes
   */
  createButton: (label: string, onClick: () => void, options?: {
    disabled?: boolean;
    ariaLabel?: string;
    ariaPressed?: boolean;
  }) => ({
    role: 'button',
    tabIndex: options?.disabled ? -1 : 0,
    'aria-label': options?.ariaLabel || label,
    'aria-pressed': options?.ariaPressed,
    'aria-disabled': options?.disabled,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
  }),

  /**
   * Create accessible form field with label
   */
  createFormField: (id: string, label: string, options?: {
    required?: boolean;
    error?: string;
    helperText?: string;
  }) => ({
    id,
    'aria-label': label,
    'aria-required': options?.required,
    'aria-invalid': !!options?.error,
    'aria-describedby': options?.error || options?.helperText ? `${id}-description` : undefined,
  }),

  /**
   * Create accessible modal dialog
   */
  createModal: (id: string, title: string) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': `${id}-title`,
    'aria-describedby': `${id}-description`,
  }),

  /**
   * Create accessible alert
   */
  createAlert: (type: 'error' | 'warning' | 'success' | 'info') => ({
    role: 'alert',
    'aria-live': type === 'error' ? 'assertive' : 'polite',
    'aria-atomic': true,
  }),

  /**
   * Skip to main content link
   */
  skipToMainContent: () => ({
    href: '#main-content',
    className: 'sr-only focus:not-sr-only',
  }),

  /**
   * Screen reader only text
   */
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
  } as React.CSSProperties,
};

/**
 * Keyboard navigation utilities
 */
export const keyboard = {
  /**
   * Handle arrow key navigation
   */
  handleArrowKeys: (e: React.KeyboardEvent, options: {
    onUp?: () => void;
    onDown?: () => void;
    onLeft?: () => void;
    onRight?: () => void;
  }) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        options.onUp?.();
        break;
      case 'ArrowDown':
        e.preventDefault();
        options.onDown?.();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        options.onLeft?.();
        break;
      case 'ArrowRight':
        e.preventDefault();
        options.onRight?.();
        break;
    }
  },

  /**
   * Check if key is Enter or Space
   */
  isActivationKey: (key: string) => key === 'Enter' || key === ' ',

  /**
   * Check if key is Escape
   */
  isEscapeKey: (key: string) => key === 'Escape',
};

/**
 * Focus management utilities
 */
export const focus = {
  /**
   * Trap focus within an element
   */
  trapFocus: (e: React.KeyboardEvent, container: HTMLElement | null) => {
    if (!container || e.key !== 'Tab') return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  },

  /**
   * Announce message to screen readers
   */
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },
};
