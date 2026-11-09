import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import ErrorBoundary from './components/CrashScreen.jsx';
import { installPops } from './store/pops.js';
import './styles.css';

installPops();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
