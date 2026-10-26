import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import App from './App';
import { store, persistor } from './store';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { registerServiceWorker } from './services/serviceWorker';
import { installGlobalErrorHandlers } from './services/globalErrorLog';
import './styles/tokens.css';
import './styles/components.css';
import './styles/screensaver.css';
import './index.css';

registerServiceWorker();
// Catch failures React boundaries never see (handlers, timers, promise rejections).
installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary level="root">
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
