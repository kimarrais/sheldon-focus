import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DynamicIslandWindow } from './components/island/DynamicIslandWindow';
import './styles/globals.css';

const isIslandWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('window') === 'island';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isIslandWindow ? <DynamicIslandWindow /> : <App />}
  </React.StrictMode>
);
