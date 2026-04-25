import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Twinum - Scout 致敬作品
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@twinum/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      },
    },
    // GitHub Pages 部署在 https://feifei21610.github.io/Twinum/ 下（注意仓库名首字母大写），
    // 所有资源需要 /Twinum/ 前缀。本地 dev 不需要前缀；只有生产构建才加。
    base: isProd ? '/Twinum/' : '/',
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      minify: 'esbuild',
    },
    esbuild: {
      // 生产构建时剔除 debug 日志；保留 console.error 供错误兜底
      drop: isProd ? ['debugger'] : [],
      pure: isProd ? ['console.debug', 'console.log'] : [],
    },
  };
});
