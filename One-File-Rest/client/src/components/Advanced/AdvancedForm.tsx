import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useForm, Controller, FieldValues, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface AdvancedFormProps<T extends FieldValues> {
  schema: z.ZodSchema;
  onSubmit: SubmitHandler<T>;
  fields: FormField<T>[];
  submitText?: string;
  isLoading?: boolean;
  successMessage?: string;
  errorMessage?: string;
  layout?: 'single' | 'two-column' | 'three-column';
  showValidation?: boolean;
}

interface FormField<T extends FieldValues> {
  name: keyof T;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string | number }[];
  validation?: string;
  helperText?: string;
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
}

export const AdvancedForm = React.forwardRef<HTMLFormElement, AdvancedFormProps<any>>(
  ({
    schema,
    onSubmit,
    fields,
    submitText = 'Submit',
    isLoading = false,
    successMessage,
    errorMessage,
    layout = 'single',
    showValidation = true,
  }, ref) => {
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
      control,
      handleSubmit,
      formState: { errors, isSubmitting },
      watch,
    } = useForm({
      resolver: zodResolver(schema),
      mode: 'onChange',
    });

    const handleFormSubmit = useCallback(async (data: any) => {
      try {
        setSubmitError(null);
        await onSubmit(data);
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'An error occurred');
      }
    }, [onSubmit]);

    const gridClass = {
      single: 'grid-cols-1',
      'two-column': 'md:grid-cols-2',
      'three-column': 'md:grid-cols-3',
    }[layout];

    return (
      <motion.form
        ref={ref}
        onSubmit={handleSubmit(handleFormSubmit)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-6"
      >
        {/* Status Messages */}
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-200"
          >
            <CheckCircle className="h-5 w-5" />
            <span>{successMessage || 'Form submitted successfully!'}</span>
          </motion.div>
        )}

        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200"
          >
            <AlertCircle className="h-5 w-5" />
            <span>{submitError}</span>
          </motion.div>
        )}

        {/* Form Fields */}
        <div className={`grid ${gridClass} gap-6`}>
          {fields.map((field, idx) => (
            <FormField
              key={String(field.name)}
              field={field}
              control={control}
              error={errors[field.name]}
              showValidation={showValidation}
            />
          ))}
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting || isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
              />
              Processing...
            </div>
          ) : (
            submitText
          )}
        </motion.button>
      </motion.form>
    );
  }
);

AdvancedForm.displayName = 'AdvancedForm';

// Form Field Component
interface FormFieldProps {
  field: FormField<any>;
  control: any;
  error?: any;
  showValidation?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({ field, control, error, showValidation }) => {
  return (
    <Controller
      name={String(field.name)}
      control={control}
      render={({ field: fieldProps }) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={field.fullWidth ? 'col-span-full' : ''}
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              {...fieldProps}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className={`w-full px-4 py-2 border-2 rounded-lg transition-all focus:outline-none dark:bg-gray-800 dark:text-white ${
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-gray-600'
              }`}
            />
          ) : field.type === 'select' ? (
            <select
              {...fieldProps}
              className={`w-full px-4 py-2 border-2 rounded-lg transition-all focus:outline-none dark:bg-gray-800 dark:text-white ${
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-gray-600'
              }`}
            >
              <option value="">Select {field.label}</option>
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...fieldProps}
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
            </label>
          ) : (
            <input
              {...fieldProps}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              className={`w-full px-4 py-2 border-2 rounded-lg transition-all focus:outline-none dark:bg-gray-800 dark:text-white ${
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-gray-600'
              }`}
            />
          )}

          {showValidation && error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 text-sm text-red-500"
            >
              {error.message}
            </motion.p>
          )}

          {field.helperText && !error && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{field.helperText}</p>
          )}
        </motion.div>
      )}
    />
  );
};
