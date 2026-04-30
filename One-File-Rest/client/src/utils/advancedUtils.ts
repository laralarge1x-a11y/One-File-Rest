// Utility functions for advanced components

// Animation variants for Framer Motion
export const animationVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
};

// Color utilities
export const colorUtils = {
  hexToRgb: (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  rgbToHex: (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  isDarkColor: (hex: string) => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return false;
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 128;
  },
};

// String utilities
export const stringUtils = {
  truncate: (str: string, length: number) => {
    return str.length > length ? str.substring(0, length) + '...' : str;
  },

  capitalize: (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  camelToKebab: (str: string) => {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  },

  kebabToCamel: (str: string) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  },
};

// Number utilities
export const numberUtils = {
  formatNumber: (num: number, decimals = 0) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  formatCurrency: (num: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(num);
  },

  formatPercent: (num: number, decimals = 0) => {
    return `${numberUtils.formatNumber(num, decimals)}%`;
  },

  clamp: (num: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, num));
  },
};

// Date utilities
export const dateUtils = {
  formatDate: (date: Date | string, format = 'MM/DD/YYYY') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  },

  formatTime: (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  },

  formatRelative: (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return dateUtils.formatDate(d);
  },
};

// Validation utilities
export const validationUtils = {
  isEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isPhone: (phone: string) => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  isUrl: (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  isStrongPassword: (password: string) => {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[!@#$%^&*]/.test(password)
    );
  },
};

// Array utilities
export const arrayUtils = {
  chunk: <T,>(arr: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  unique: <T,>(arr: T[]) => {
    return Array.from(new Set(arr));
  },

  shuffle: <T,>(arr: T[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  groupBy: <T,>(arr: T[], key: keyof T) => {
    return arr.reduce(
      (acc, item) => {
        const groupKey = String(item[key]);
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  },
};

// Object utilities
export const objectUtils = {
  deepClone: <T,>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  },

  merge: <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
    return { ...target, ...source };
  },

  pick: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = obj[key];
    });
    return result;
  },

  omit: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
    const result = { ...obj };
    keys.forEach((key) => {
      delete result[key];
    });
    return result;
  },
};

// CSS utilities
export const cssUtils = {
  cn: (...classes: (string | undefined | null | false)[]) => {
    return classes.filter(Boolean).join(' ');
  },

  getContrastColor: (hex: string) => {
    return colorUtils.isDarkColor(hex) ? '#ffffff' : '#000000';
  },
};
