import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import App from './App';
import { registerServiceWorker } from './lib/push';
import './styles/design-system.css';
import './styles/shadcn-overrides.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

if (window.location.hostname !== 'localhost') {
  registerServiceWorker().catch(() => {});
}