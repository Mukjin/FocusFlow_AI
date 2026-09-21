import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const aiEndpoint = env.VITE_AI_ENDPOINT ?? '';
  const clientKey = env.VITE_GEMINI_API_KEY ?? '';

  // 서버 함수를 쓰는 빌드에 클라이언트 키가 함께 들어가면 프록시를 둔 의미가 없다.
  // 문서로 주의를 주는 대신 빌드를 실패시켜 물리적으로 막는다.
  if (aiEndpoint && clientKey) {
    throw new Error(
      [
        '',
        'VITE_AI_ENDPOINT 와 VITE_GEMINI_API_KEY 를 동시에 설정할 수 없습니다.',
        '',
        '  · 서버 함수(프록시)를 쓰는 배포  → VITE_AI_ENDPOINT 만 설정하고,',
        '    키는 서버 전용 환경변수 GEMINI_API_KEY 로 두세요.',
        '  · 로컬 개발(브라우저 직접 호출) → VITE_GEMINI_API_KEY 만 설정하세요.',
        '',
        'VITE_ 접두사가 붙은 값은 번들에 그대로 들어가 공개됩니다.',
        '',
      ].join('\n'),
    );
  }

  return {
    // GitHub Pages 프로젝트 사이트만 /FocusFlow_AI/ 하위 경로로 서빙된다.
    // Vercel(루트 도메인)과 로컬 개발에서는 루트를 쓴다.
    base: env.DEPLOY_TARGET === 'gh-pages' ? '/FocusFlow_AI/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
