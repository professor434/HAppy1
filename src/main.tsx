// Import Buffer polyfill first before any other imports
import './buffer-polyfill.ts';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
