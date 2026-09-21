import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// 환경변수가 없으면 createClient가 모듈 로드 시점에 예외를 던져 앱 전체가 흰 화면이 된다.
// 저장 기능만 비활성화하고 앱은 정상 동작하도록 no-op 클라이언트로 대체한다.
function createOfflineClient(): SupabaseClient {
  const notConfigured = { data: null, error: { message: 'Supabase가 설정되지 않았습니다.', code: 'NOT_CONFIGURED' } };
  const query: any = {
    select: () => query,
    eq: () => query,
    single: async () => notConfigured,
    then: (resolve: (v: unknown) => void) => resolve(notConfigured),
    upsert: async () => notConfigured,
  };
  return { from: () => query } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createOfflineClient();
