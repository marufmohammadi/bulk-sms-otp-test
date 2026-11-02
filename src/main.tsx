import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent Vite HMR WebSocket disconnection notices from showing as unhandled rejections in preview iframe
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string' ? reason : reason?.message || '';
  if (message.includes('WebSocket') || message.includes('vite')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
