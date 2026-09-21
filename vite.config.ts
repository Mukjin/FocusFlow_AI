import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // GitHub Pages 프로젝트 사이트는 /FocusFlow_AI/ 하위 경로로 서빙된다.
    // 로컬 개발(dev)에서는 루트를 그대로 쓴다.
    base: mode === 'production' ? '/FocusFlow_AI/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      // 하위 호환용. 이 값은 번들에 그대로 들어가므로 공개 배포 시 키가 노출된다.
      // 로컬 실행 전용으로만 쓸 것. (README 의 보안 주의 참고)
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
