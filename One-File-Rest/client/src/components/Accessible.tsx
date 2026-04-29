import React from 'react';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  ariaLabel,
  ariaDescribedBy,
  children,
  ...props
}) => (
  <button
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    {...props}
  >
    {children}
  </button>
);

interface AccessibleLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  children: React.ReactNode;
}

export const AccessibleLink: React.FC<AccessibleLinkProps> = ({
  ariaLabel,
  ariaDescribedBy,
  children,
  ...props
}) => (
  <a
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    {...props}
  >
    {children}
  </a>
);

interface AccessibleFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  ariaLabel?: string;
  children: React.ReactNode;
}

export const AccessibleForm: React.FC<AccessibleFormProps> = ({
  ariaLabel,
  children,
  ...props
}) => (
  <form
    aria-label={ariaLabel}
    {...props}
  >
    {children}
  </form>
);

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  error,
  helperText,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        aria-invalid={!!error}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
        }`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="mt-1 text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
};
