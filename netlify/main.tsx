import { createRoot } from 'react-dom/client';
import Parkly from '../app/parkly';
import PwaStatus from '../components/pwa-status';
import '../app/globals.css';

// Reuse the current application, hash navigation and PWA component unchanged.
const root = document.getElementById('root');
if (!root) throw Error('Parkly application root is missing.');
createRoot(root).render(<><PwaStatus /><aside className="educational-notice" aria-label="Educational prototype">Educational prototype · All accounts, parking listings and reservations are fictional. No real payments or physical parking access.</aside><Parkly /></>);
