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

// Edge 런타임은 25초 안에 응답을 시작해야 해서, 30개 넘는 주제를 한 번에
// 생성할 때 FUNCTION_INVOCATION_TIMEOUT 이 난다. Node 런타임으로 여유를 둔다.
export const config = { maxDuration: 60 };

/**
 * 앞에서부터 시도한다.
 * 프리뷰 모델은 "high demand" 로 자주 거절당하므로 안정 모델을 먼저 쓴다.
 * 한 모델이 과부하면 다음 모델로 넘어간다.
 */
const MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/* 공개 엔드포인트라 남의 키를 태워 쓰지 못하도록 입력을 좁게 제한한다 */
/* 한 번에 물어보는 항목 수. 작을수록 빠르고 덜 끊긴다. */
/* 한 번에 물어보는 항목 수. 작을수록 빨리 끝나고 덜 끊긴다. */
const CHUNK_SIZE = 10;
/* 동시에 띄우는 업스트림 호출 수 */
/* 동시 호출 수. 안정 모델은 3~4 동시 호출을 문제없이 받는다. */
const MAX_CONCURRENCY = 4;
/**
 * 전체 시간 예산(ms).
 * Gemini 무료 등급은 같은 요청이 6초에 끝나기도 하고 40초가 걸리기도 한다.
 * 이 변동을 코드로 없앨 수는 없으니, 예산을 넘기면 그때까지 받은 것만 돌려준다.
 * 함수 타임아웃(60초)으로 통째 실패하는 것보다, 일부라도 채워 보내는 편이 낫다.
 * 클라이언트는 모자란 자리에 규칙 엔진 문구를 그대로 둔다.
 */
const TIME_BUDGET_MS = 40_000;

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

interface Chunk {
  subject: string;
  phase: string;
  count: number;
  offset: number;
  total: number;
}

/** 덩어리 하나(한 과목·한 단계의 일부)만 요청한다. 짧을수록 빠르고 덜 끊긴다. */
function buildPrompt(chunk: Chunk, extraRequest: string): string {
  const { subject, phase, count, offset, total } = chunk;
  const position =
    total > count
      ? `이 과목의 ${phase} 단계는 총 ${total}일 분량이며, 지금은 그중 ${offset + 1}일차부터 ${offset + count}일차까지를 만드는 중입니다.`
      : '';

  return `
학습 과목: ${subject}
학습 단계: ${phase}
${position}
${extraRequest ? `사용자의 추가 요청사항: "${extraRequest}"` : ''}

위 과목의 ${phase} 단계에 맞는 일별 학습 주제를 정확히 ${count}개 작성해주세요.
각 항목은 **25자 이내의 짧은 구(句)**로 쓰세요. 문장으로 길게 늘이지 마세요.
예: "정렬 알고리즘 시간복잡도 비교", "DB 정규화 1~3NF 정리"
서로 다른 내용이어야 하며, 같은 문구를 반복하지 마세요.

URL이나 링크는 절대 포함하지 마세요. 검색 없이 지어낸 링크는 실제로 열리지 않기 때문입니다.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 설명은 포함하지 마세요:
["학습 주제1", "학습 주제2"]
`.trim();
}

/** 응답에서 문자열 배열만 끄집어낸다 */
function parseTasks(text: string): string[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t: unknown) => (typeof t === 'string' ? t : (t as any)?.task))
      .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0);
  } catch {
    return [];
  }
}

/** 한 덩어리를 Gemini 에 물어본다. 실패하면 빈 배열 — 그 자리는 규칙 엔진 문구가 남는다. */
async function fetchChunk(
  chunk: Chunk,
  extraRequest: string,
  apiKey: string,
  deadline: number,
): Promise<string[]> {
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: buildPrompt(chunk, extraRequest) }] }],
  });

  // 모델을 바꿔가며 시도한다. 과부하(503)·한도(429)는 다음 모델로 넘긴다.
  for (const model of MODELS) {
    const remaining = deadline - Date.now();
    if (remaining <= 1500) return []; // 남은 예산으로는 끝낼 수 없다

    let res: Response;
    try {
      res = await fetch(endpointFor(model), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal: AbortSignal.timeout(remaining),
      });
    } catch {
      continue;
    }

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const text: string =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
      const tasks = parseTasks(text);
      if (tasks.length > 0) return tasks;
      continue; // 빈 응답이면 다음 모델
    }

    // 4xx 중 요청 자체가 잘못된 경우는 모델을 바꿔도 같으므로 중단
    if (res.status < 500 && res.status !== 429) return [];
  }
  return [];
}

export async function handleRequest(req: Request): Promise<Response> {
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
  // 한 번에 30개를 만들면 25~40초가 걸려 함수가 타임아웃된다.
  // 과목·단계를 작은 덩어리로 쪼개 병렬로 물어보면 전체 시간이
  // '가장 느린 한 덩어리'로 줄고, 일부가 실패해도 나머지는 살아남는다.
  const chunks: Chunk[] = [];
  for (const [subject, phases] of Object.entries(counts)) {
    for (const [phase, total] of Object.entries(phases)) {
      for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
        chunks.push({
          subject,
          phase,
          offset,
          total,
          count: Math.min(CHUNK_SIZE, total - offset),
        });
      }
    }
  }

  // 동시 호출 수를 제한해 업스트림 한도에 부딪히지 않게 한다.
  // 예산을 넘기면 남은 덩어리는 건너뛴다 — 통째 실패보다 부분 성공이 낫다.
  const deadline = Date.now() + TIME_BUDGET_MS;
  const results: { subject: string; phase: string; offset: number; tasks: string[] }[] = [];
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const batch = chunks.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (c) => ({
        subject: c.subject,
        phase: c.phase,
        offset: c.offset,
        tasks: await fetchChunk(c, extraRequest, apiKey, deadline),
      })),
    );
    results.push(...settled);
  }

  // 덩어리를 원래 순서대로 다시 이어 붙인다
  const merged: Record<string, Record<string, string[]>> = {};
  results
    .sort((a, b) => a.offset - b.offset)
    .forEach(({ subject, phase, tasks }) => {
      merged[subject] ??= {};
      merged[subject][phase] = (merged[subject][phase] ?? []).concat(tasks);
    });

  const items = Object.entries(merged).flatMap(([subject, phases]) =>
    Object.entries(phases).map(([phase, tasks]) => ({ subject, phase, tasks })),
  );

  const produced = items.reduce((n, it) => n + it.tasks.length, 0);
  if (produced === 0) {
    return json(502, { error: 'Gemini가 유효한 응답을 주지 않았습니다. 잠시 후 다시 시도해주세요.' }, req);
  }

  return json(200, { items }, req);
}

/* ────────────────────────────────────────────────────────────
   Vercel Node 런타임 어댑터.
   핵심 로직(handleRequest)은 Web 표준이라 Cloudflare Workers ·
   Netlify Edge 에서는 그대로 default export 로 쓰면 된다.
   ──────────────────────────────────────────────────────────── */
export default async function handler(req: any, res: any) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c);

  const url = `https://${req.headers.host ?? 'localhost'}${req.url ?? '/api/gemini'}`;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });

  const out = await handleRequest(request);
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.status(out.status).send(await out.text());
}
