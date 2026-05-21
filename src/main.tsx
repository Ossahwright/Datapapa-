import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

<<<<<<< HEAD
// Global error handlers to capture stale/invalid Supabase refresh tokens
const cleanStaleAuthSession = (message: string) => {
  const normMsg = message.toLowerCase();
  if (
    normMsg.includes('refresh token') ||
    normMsg.includes('refresh_token') ||
    normMsg.includes('session missing') ||
    normMsg.includes('invalid_grant')
  ) {
    console.warn('⚡ Detected unhandled refresh token error. Purging persistent state in localStorage and refreshing...');
    localStorage.removeItem('datapapa-auth-token');
    setTimeout(() => {
      window.location.reload();
    }, 150);
    return true;
  }
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || String(reason || '');
  if (cleanStaleAuthSession(message)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const message = event.message || '';
  if (cleanStaleAuthSession(message)) {
    event.preventDefault();
  }
});

=======
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
createRoot(document.getElementById('root')!).render(
  <App />
);
