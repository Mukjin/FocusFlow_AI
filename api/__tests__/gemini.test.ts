import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleRequest } from '../gemini';

const post = (body: unknown, origin?: string) =>
  new Request('https://example.com/api/gemini', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // 빈도 제한이 IP 단위라 테스트마다 다른 IP 를 쓴다
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });

const geminiOk = (tasks: string[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(tasks) }] } }] }),
});

beforeEach(() => {
  (globalThis as any).process.env.GEMINI_API_KEY = 'test-key';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('입력 검증 — 공개 엔드포인트라 좁게 막아야 한다', () => {
  it('POST 가 아니면 거절한다', async () => {
    const res = await handleRequest(new Request('https://example.com/api/gemini'));
    expect(res.status).toBe(405);
  });

  it('goals 가 없으면 거절한다', async () => {
    const res = await handleRequest(post({ counts: { x: { 기초: 1 } } }));
    expect(res.status).toBe(400);
  });

  it('counts 가 없으면 거절한다', async () => {
    const res = await handleRequest(post({ goals: ['토익'] }));
    expect(res.status).toBe(400);
  });

  it('goals 에 없는 과목은 무시한다', async () => {
    // 남이 임의 주제를 밀어넣어 키를 태워 쓰는 것을 막는 핵심 방어
    const res = await handleRequest(post({ goals: ['토익'], counts: { 해킹강좌: { 기초: 5 } } }));
    expect(res.status).toBe(400);
  });

  it('알 수 없는 학습 단계는 무시한다', async () => {
    const res = await handleRequest(post({ goals: ['토익'], counts: { 토익: { 아무거나: 5 } } }));
    expect(res.status).toBe(400);
  });

  it('본문이 너무 크면 거절한다', async () => {
    const res = await handleRequest(post({ goals: ['토익'], counts: { 토익: { 기초: 1 } }, junk: 'x'.repeat(20000) }));
    expect(res.status).toBe(413);
  });

  it('서버에 키가 없으면 500 으로 알린다', async () => {
    delete (globalThis as any).process.env.GEMINI_API_KEY;
    const res = await handleRequest(post({ goals: ['토익'], counts: { 토익: { 기초: 1 } } }));
    expect(res.status).toBe(500);
  });
});

describe('CORS — 기본은 같은 도메인만', () => {
  it('ALLOWED_ORIGIN 이 없으면 CORS 헤더를 주지 않는다', async () => {
    const res = await handleRequest(
      new Request('https://example.com/api/gemini', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('허용된 오리진만 통과시킨다', async () => {
    (globalThis as any).process.env.ALLOWED_ORIGIN = 'https://ok.example';
    const allowed = await handleRequest(
      new Request('https://example.com/api/gemini', { method: 'OPTIONS', headers: { origin: 'https://ok.example' } }),
    );
    const blocked = await handleRequest(
      new Request('https://example.com/api/gemini', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://ok.example');
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
    delete (globalThis as any).process.env.ALLOWED_ORIGIN;
  });
});

describe('빈도 제한', () => {
  it('같은 IP 가 연달아 부르면 429 를 낸다', async () => {
    const ip = '203.0.113.7';
    const call = () =>
      handleRequest(
        new Request('https://example.com/api/gemini', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
          body: JSON.stringify({ goals: [] }),
        }),
      );
    const codes: number[] = [];
    for (let i = 0; i < 8; i += 1) codes.push((await call()).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });
});

describe('Gemini 응답 처리', () => {
  it('모델이 준 주제를 구조화해 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk(['주제1', '주제2'])));
    const res = await handleRequest(post({ goals: ['토익'], counts: { 토익: { 기초: 2 } } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ subject: '토익', phase: '기초' });
    expect(body.items[0].tasks).toEqual(['주제1', '주제2']);
  });

  it('모델이 계속 실패하면 502 로 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const res = await handleRequest(post({ goals: ['토익'], counts: { 토익: { 기초: 2 } } }));
    expect(res.status).toBe(502);
  });
});
