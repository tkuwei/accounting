import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 關鍵設定：使用相對路徑 './'，確保在 GitHub Pages 子目錄 (https://user.github.io/repo/) 能正確載入資源
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});