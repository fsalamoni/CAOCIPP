import base44Plugin from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44Plugin({
      // Support for legacy code that imports the SIGO SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.VITE_SIGO_LEGACY_SDK_IMPORTS === 'true' || process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Firebase e React mudam pouco: em arquivos próprios, o navegador os
        // mantém em cache entre um deploy e outro e só baixa o código do SIGO.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Storage só no envio de arquivos: fora do pacote que toda página baixa.
          if (/node_modules\/(@firebase\/storage|firebase\/storage)\//.test(id)) return 'vendor-firebase-storage';
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'vendor-firebase';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});