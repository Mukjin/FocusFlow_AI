/**
 * Gemini 호출 프록시.
 *
 * 브라우저에서 Gemini를 직접 부르면 API 키가 번들에 박혀 그대로 노출된다.
 * 이 함수가 키를 서버에만 두고 대신 호출한다.
 *
 * 프롬프트 조립도 여기서 한다. 클라이언트는 '과목·단계별로 몇 개가 필요한지'
 * 라는 구조화된 데이터만 보내고, 문장은 서버가 만든다. 그래야 남이 이 엔드포인트로
 * 임의의 프롬프트를 밀어넣어 남의 키로 아무 작업이나 시키는 일을 막을 수 있다.
 *
 * Web 표준 Request/Response 시그니처라 Vercel Edge · Cloudflare Workers ·
 * Netlify Edge 어디든 거의 그대로 올라간다.
 */

export const config = { runtime: 'edge' };

const MODEL = 'gemini-3-flash-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/* 공개 엔드포인트라 남의 키를 태워 쓰지 못하도록 입력을 좁게 제한한다 */
const LIMITS = {
  bodyBytes: 16 * 1024,
  goals: 12,
  goalLength: 60,
  extraRequest: 300,
  totalTasks: 400,
};

/**
 * 아주 단순한 IP 단위 빈도 제한.
 * 엣지 함수는 인스턴스마다 메모리가 따로라 완벽한 방어는 아니다.
 * 스크립트로 긁어가는 것을 늦추는 용도이고, 확실히 막으려면
 * 외부 저장소(KV·Redis)를 쓰거나 인증을 붙여야 한다.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // 메모리가 무한정 늘지 않게
  return false;
}

/**
 * 기본은 같은 도메인에서만 부를 수 있다(사이트와 함수를 한 번에 배포하는 구성).
 * 함수를 따로 떼어 배포할 때만 ALLOWED_ORIGIN 에 사이트 주소를 넣는다.
 * 와일드카드를 열어두면 아무 사이트나 이 키를 태워 쓸 수 있으므로 열지 않는다.
 */
function corsHeaders(req: Request): Record<string, string> {
  const allowed = (globalThis as any).process?.env?.ALLOWED_ORIGIN;
  const origin = req.headers.get('origin');
  if (!allowed || !origin || origin !== allowed) return {};
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}

const json = (status: number, data: unknown, req?: Request) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(req ? corsHeaders(req) : {}),
    },
  });

type Counts = Record<string, Record<string, number>>;

function buildPrompt(goals: string[], extraRequest: string, counts: Counts): string {
  return `
사용자의 학습 목표(과목): ${goals.join(', ')}
${extraRequest
      ? `사용자의 추가 요청사항: "${extraRequest}"`
      : '각 과목의 특성과 학습 단계(기초/심화/마무리)에 맞게 할 일(task)을 구체적이고 실용적으로 작성해주세요.'}

다음은 각 과목 및 학습 단계별로 필요한 일별 학습 주제(task)의 개수입니다:
${JSON.stringify(counts, null, 2)}

위 개수에 정확히 맞춰서 각 과목의 단계별 일별 학습 주제를 배열 형태로 작성해주세요.
배열의 길이는 요청한 개수와 정확히 일치해야 합니다.
같은 문구를 반복하지 말고, 날짜마다 다른 구체적인 학습 주제를 써주세요.

URL이나 링크는 절대 포함하지 마세요. 검색 없이 지어낸 링크는 실제로 열리지 않기 때문입니다.

반드시 다음 JSON 배열 형식으로만 응답해주세요. 다른 설명은 포함하지 마세요:
[
  {
    "subject": "과목명",
    "phase": "학습 단계",
    "tasks": ["학습 주제1", "학습 주제2"]
  }
]
`.trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(405, { error: 'POST만 허용됩니다.' }, req);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return json(429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' }, req);
  }

  const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' }, req);
  }

  const raw = await req.text();
  if (raw.length > LIMITS.bodyBytes) {
    return json(413, { error: '요청이 너무 큽니다.' }, req);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: '본문이 올바른 JSON이 아닙니다.' }, req);
  }

  // ── 입력 검증 ────────────────────────────────────────────
  const goals: string[] = Array.isArray(body?.goals)
    ? body.goals
        .filter((g: unknown): g is string => typeof g === 'string')
        .slice(0, LIMITS.goals)
        .map((g: string) => g.slice(0, LIMITS.goalLength))
    : [];
  if (goals.length === 0) return json(400, { error: 'goals가 비어 있습니다.' }, req);

  const extraRequest =
    typeof body?.extraRequest === 'string' ? body.extraRequest.slice(0, LIMITS.extraRequest) : '';

  const rawCounts = body?.counts;
  if (!rawCounts || typeof rawCounts !== 'object') {
    return json(400, { error: 'counts가 없습니다.' }, req);
  }

  // 총량 상한까지만 채우고 나머지는 잘라낸다.
  // 클라이언트는 받은 만큼만 앞에서부터 쓰고 모자라는 자리는 규칙 엔진 문구를
  // 그대로 두므로, 잘려도 일정이 깨지지 않는다.
  const counts: Counts = {};
  let totalTasks = 0;
  outer: for (const [subject, phases] of Object.entries(rawCounts)) {
    if (!goals.includes(subject) || !phases || typeof phases !== 'object') continue;
    for (const [phase, n] of Object.entries(phases as Record<string, unknown>)) {
      if (!['기초', '심화', '마무리'].includes(phase)) continue;
      const count = Math.floor(Number(n));
      if (!Number.isFinite(count) || count <= 0) continue;

      const room = LIMITS.totalTasks - totalTasks;
      if (room <= 0) break outer;

      const take = Math.min(count, room);
      counts[subject] ??= {};
      counts[subject][phase] = take;
      totalTasks += take;
    }
  }
  if (totalTasks === 0) return json(400, { error: '요청할 항목이 없습니다.' }, req);

  // ── Gemini 호출 ─────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey, // URL 대신 헤더로 — 로그에 키가 남지 않는다
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(goals, extraRequest, counts) }] }],
      }),
    });
  } catch {
    return json(502, { error: 'Gemini에 연결하지 못했습니다.' }, req);
  }

  if (!upstream.ok) {
    // 업스트림 본문에 키가 섞여 돌아가지 않도록 상태코드만 전달한다
    return json(upstream.status === 429 ? 429 : 502, {
      error:
        upstream.status === 429
          ? 'Gemini 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
          : `Gemini 응답 오류 (${upstream.status})`,
    }, req);
  }

  const data = await upstream.json().catch(() => null);
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  if (!text) return json(502, { error: 'Gemini 응답이 비어 있습니다.' }, req);

  return json(200, { text }, req);
}
