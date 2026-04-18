import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import './store/theme'; // initialize theme on app load

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ne pas retenter si c'est une erreur HTTP 4xx (erreur client, pas réseau)
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
    },
    mutations: {
      // Jamais de retry sur les mutations : une action qui échoue doit échouer proprement
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" toastOptions={{
        style: { fontFamily: 'DM Sans, sans-serif', borderRadius: '12px', fontSize: '14px' },
      }} />
    </QueryClientProvider>
  </React.StrictMode>
);
