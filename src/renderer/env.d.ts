/// <reference types="vite/client" />

import type { SheldonElectronAPI } from '../shared/types';

declare global {
  interface Window {
    sheldonAPI?: SheldonElectronAPI;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}
