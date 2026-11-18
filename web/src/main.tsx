import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { setupIonicReact } from '@ionic/react';
import App from './App';
import { I18nProvider } from './i18n';
import { StoreProvider } from './store';
/* Ionic（开源 UI 组件库，MIT）基础样式 */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme.css';
import './styles.css';

setupIonicReact({ mode: 'md' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <StoreProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StoreProvider>
    </I18nProvider>
  </React.StrictMode>,
);
