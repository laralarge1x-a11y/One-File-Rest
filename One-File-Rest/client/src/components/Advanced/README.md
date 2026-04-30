# Advanced UI/UX Components Library

A comprehensive, production-ready component library built with React, TypeScript, Tailwind CSS, and Framer Motion. Designed for both mobile and desktop platforms with enterprise-grade features.

## 🎯 Features

### Core Components
- **AdvancedButton** - Animated button with multiple variants and sizes
- **AdvancedModal** - Smooth modal with backdrop and animations
- **AdvancedInput** - Enhanced input with validation and icons
- **AdvancedForm** - Complete form system with React Hook Form integration
- **AdvancedCard** - Flexible card component with hover effects
- **AdvancedBadge** - Status badges with multiple variants
- **AdvancedSkeleton** - Loading skeleton with animations
- **AdvancedToast** - Toast notifications with auto-dismiss

### Advanced Components
- **AdvancedTable** - Feature-rich table with sorting, filtering, pagination
- **AdvancedNavigation** - Responsive navigation with mobile drawer
- **AdvancedDashboard** - Customizable dashboard with drag-and-drop widgets
- **AdvancedChart** - Interactive charts (line, bar, pie) with Recharts
- **AdvancedSearch** - Advanced search with suggestions and history
- **AdvancedPagination** - Smart pagination with page numbers
- **AdvancedAccordion** - Expandable accordion with smooth animations
- **AdvancedTabs** - Tab navigation with multiple variants
- **AdvancedNotification** - Notification system with multiple types

### Theme System
- **ThemeProvider** - Light/dark mode with system preference detection
- **useTheme** - Hook for accessing theme context
- CSS variables-based theming for easy customization

## 📦 Installation

```bash
npm install framer-motion recharts react-hook-form zod @hookform/resolvers lucide-react
```

## 🚀 Quick Start

### Basic Button
```tsx
import { AdvancedButton } from '@/components/Advanced';

export default function App() {
  return (
    <AdvancedButton variant="primary" size="md">
      Click me
    </AdvancedButton>
  );
}
```

### Form with Validation
```tsx
import { AdvancedForm } from '@/components/Advanced';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginForm() {
  return (
    <AdvancedForm
      schema={schema}
      onSubmit={(data) => console.log(data)}
      fields={[
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true },
      ]}
      submitText="Login"
    />
  );
}
```

### Advanced Table
```tsx
import { AdvancedTable } from '@/components/Advanced';

const data = [
  { id: '1', name: 'John', email: 'john@example.com', status: 'Active' },
  { id: '2', name: 'Jane', email: 'jane@example.com', status: 'Inactive' },
];

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'status', label: 'Status', filterable: true },
];

export default function Table() {
  return (
    <AdvancedTable
      data={data}
      columns={columns}
      searchable
      filterable
      exportable
      pagination
    />
  );
}
```

### Dashboard with Widgets
```tsx
import { AdvancedDashboard, MetricWidget } from '@/components/Advanced';

export default function Dashboard() {
  const widgets = [
    { id: '1', type: 'metric', title: 'Revenue', size: 'small' },
    { id: '2', type: 'chart', title: 'Sales', size: 'large' },
  ];

  return (
    <AdvancedDashboard widgets={widgets} editable>
      <MetricWidget label="Total Revenue" value="$45,231" change={12} trend="up" />
    </AdvancedDashboard>
  );
}
```

## 🎨 Theming

### Setup Theme Provider
```tsx
import { ThemeProvider } from '@/components/Advanced';

export default function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}
```

### Use Theme Hook
```tsx
import { useTheme } from '@/components/Advanced';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
}
```

## 🪝 Custom Hooks

### useModal
```tsx
const { isOpen, open, close, toggle } = useModal();
```

### useFormState
```tsx
const { values, errors, handleChange, resetForm } = useFormState({
  email: '',
  password: '',
});
```

### usePagination
```tsx
const { currentPage, totalPages, goToPage, nextPage, prevPage } = usePagination(100, 10);
```

### useDebounce
```tsx
const debouncedValue = useDebounce(searchQuery, 300);
```

### useAsync
```tsx
const { data, loading, error, execute } = useAsync(() => fetchData());
```

## 🛠️ Utility Functions

### String Utilities
```tsx
import { stringUtils } from '@/utils/advancedUtils';

stringUtils.truncate('Long text', 10); // 'Long te...'
stringUtils.capitalize('hello'); // 'Hello'
stringUtils.camelToKebab('helloWorld'); // 'hello-world'
```

### Number Utilities
```tsx
import { numberUtils } from '@/utils/advancedUtils';

numberUtils.formatNumber(1234567); // '1,234,567'
numberUtils.formatCurrency(99.99); // '$99.99'
numberUtils.formatPercent(75); // '75%'
```

### Date Utilities
```tsx
import { dateUtils } from '@/utils/advancedUtils';

dateUtils.formatDate(new Date()); // '12/25/2024'
dateUtils.formatRelative(new Date()); // '2 hours ago'
```

### Validation Utilities
```tsx
import { validationUtils } from '@/utils/advancedUtils';

validationUtils.isEmail('test@example.com'); // true
validationUtils.isPhone('555-123-4567'); // true
validationUtils.isStrongPassword('Secure@123'); // true
```

## 📱 Responsive Design

All components are mobile-first and responsive:

```tsx
// Mobile: 1 column
// Tablet (md): 2 columns
// Desktop (lg): 3 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>
```

## ♿ Accessibility

All components include:
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Color contrast compliance (WCAG AAA)

## 🎬 Animations

Built-in animation variants using Framer Motion:

```tsx
import { animationVariants } from '@/utils/advancedUtils';

<motion.div
  initial={animationVariants.slideInUp.initial}
  animate={animationVariants.slideInUp.animate}
  exit={animationVariants.slideInUp.exit}
>
  Content
</motion.div>
```

## 🌙 Dark Mode

All components support dark mode out of the box:

```tsx
// Automatically applies dark mode classes
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

## 📊 Performance

- Code splitting with lazy loading
- Memoized components to prevent unnecessary re-renders
- Optimized animations with GPU acceleration
- Virtual scrolling for large lists
- Debounced search and input handlers

## 🧪 Testing

Components are built with testability in mind:

```tsx
import { render, screen } from '@testing-library/react';
import { AdvancedButton } from '@/components/Advanced';

test('renders button', () => {
  render(<AdvancedButton>Click me</AdvancedButton>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## 📚 Component Props

### AdvancedButton
```tsx
interface AdvancedButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}
```

### AdvancedTable
```tsx
interface AdvancedTableProps {
  data: any[];
  columns: Column[];
  onRowClick?: (row: any) => void;
  selectable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  itemsPerPage?: number;
}
```

### AdvancedForm
```tsx
interface AdvancedFormProps {
  schema: z.ZodSchema;
  onSubmit: SubmitHandler<any>;
  fields: FormField[];
  submitText?: string;
  isLoading?: boolean;
  layout?: 'single' | 'two-column' | 'three-column';
}
```

## 🚀 Production Ready

✅ TypeScript support
✅ Error handling
✅ Input validation
✅ Accessibility compliance
✅ Performance optimized
✅ Dark mode support
✅ Mobile responsive
✅ Comprehensive documentation

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please follow the existing code style and add tests for new features.

## 📞 Support

For issues and questions, please open an issue on GitHub.
