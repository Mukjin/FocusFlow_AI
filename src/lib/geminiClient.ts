import { GoogleGenAI } from "@google/genai";

/**
 * AI 구체화 호출.
 *
 * 두 가지 경로를 지원한다.
 *
 *  1) 프록시 모드 — VITE_AI_ENDPOINT 가 설정된 빌드(배포본).
 *     서버 함수가 키를 쥐고 대신 호출한다. 브라우저에 키가 없다.
 *  2) 직접 모드 — 로컬 개발. .env.local 의 키로 브라우저가 바로 호출한다.
 *     서버 함수를 띄우지 않아도 되니 개발이 편하다.
 *
 * 어느 쪽인지는 빌드 시점에 결정된다. "될 수도 있다"로 두면 사이드바 상태 표시가
 * 거짓말을 하게 되므로, 설정된 경로만 쓴다.
 */

const AI_ENDPOINT: string = (import.meta as any).env?.VITE_AI_ENDPOINT || "";

export function getGeminiApiKey(): string {
  // VITE_ 접두사가 붙은 값만 읽는다.
  // 접두사 없는 GEMINI_API_KEY 는 서버 함수 전용이며, 클라이언트가 참조하면
  // 빌드 시 번들에 박혀 그대로 노출된다.
  return String((import.meta as any).env?.VITE_GEMINI_API_KEY ?? "");
}

export function isProxyMode(): boolean {
  return AI_ENDPOINT.length > 0;
}

export function isGeminiConfigured(): boolean {
  return isProxyMode() || getGeminiApiKey().length > 0;
}

const PROMPT_TAIL = `
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
]`;

/** 응답 텍스트에서 JSON 배열만 끄집어낸다. 모델이 설명을 덧붙여도 살아남아야 한다. */
function extractTaskMap(resultText: string): Record<string, Record<string, string[]>> {
  let jsonStr = resultText;
  const arrayMatch = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const objectMatch = resultText.match(/\{\s*"[\s\S]*\}\s*/);

  if (arrayMatch) jsonStr = arrayMatch[0];
  else if (objectMatch) jsonStr = objectMatch[0];
  else jsonStr = resultText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON:", e, "\nOriginal:", resultText);
    throw new Error("AI 응답을 분석하는 데 실패했습니다.");
  }

  // 배열을 객체로 감싸 보내는 경우까지 받아준다
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.tasks)) parsed = parsed.tasks;
    else if (Array.isArray(parsed.data)) parsed = parsed.data;
    else {
      const arrayProp = Object.values(parsed).find((v) => Array.isArray(v));
      parsed = arrayProp ?? [parsed];
    }
  }
  if (!Array.isArray(parsed)) {
    console.error("Parsed result is not an array:", parsed);
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  const taskMap: Record<string, Record<string, string[]>> = {};
  parsed.forEach((item: any) => {
    const subj = String(item?.subject || "").trim();
    const ph = String(item?.phase || "").trim();
    if (!subj || !ph) return;
    taskMap[subj] ??= {};
    // 모델이 ["주제"] 대신 [{task:"주제"}] 로 답하는 경우도 받아준다
    taskMap[subj][ph] = (item.tasks || [])
      .map((t: any) => (typeof t === "string" ? t : t?.task))
      .filter((t: any): t is string => typeof t === "string" && t.trim().length > 0);
  });
  return taskMap;
}

export async function enhanceEventsWithGemini<
  T extends { subject: string; phase: string; task: string },
>(events: T[], goals: string[], extraRequest: string): Promise<T[]> {
  // 과목·단계별로 몇 개가 필요한지 집계한다. 이 숫자가 LLM 이 구조를 못 바꾸게 막는 장치다.
  const counts: Record<string, Record<string, number>> = {};
  events.forEach((e) => {
    counts[e.subject] ??= {};
    counts[e.subject][e.phase] = (counts[e.subject][e.phase] || 0) + 1;
  });

  const resultText = isProxyMode()
    ? await callViaProxy(goals, extraRequest, counts)
    : await callDirect(goals, extraRequest, counts);

  const taskMap = extractTaskMap(resultText);

  return events.map((event) => {
    const subj = String(event.subject || "").trim();
    const ph = String(event.phase || "").trim();
    let newTask = event.task;
    if (taskMap[subj]?.[ph]?.length) {
      // 앞에서부터 하나씩 꺼내 쓴다. 모자라면 규칙 엔진이 만든 기본 문구가 그대로 남는다.
      const assigned = taskMap[subj][ph].shift();
      if (assigned) newTask = assigned;
    }
    return { ...event, task: newTask, aiEnhanced: true };
  });
}

/** 배포본 — 서버 함수가 키를 쥐고 대신 호출한다 */
async function callViaProxy(
  goals: string[],
  extraRequest: string,
  counts: Record<string, Record<string, number>>,
): Promise<string> {
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goals, extraRequest, counts }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || `AI 서버 오류 (${res.status})`);
  }
  const data = await res.json();
  if (!data?.text) throw new Error("AI 응답이 비어있습니다.");
  return data.text as string;
}

/** 로컬 개발 — 브라우저가 .env.local 의 키로 직접 호출한다 */
async function callDirect(
  goals: string[],
  extraRequest: string,
  counts: Record<string, Record<string, number>>,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API 키가 설정되지 않았습니다. .env.local 에 VITE_GEMINI_API_KEY 를 넣어주세요.",
    );
  }

  const prompt = `
      사용자의 학습 목표(과목): ${goals.join(", ")}
      ${extraRequest
      ? `사용자의 추가 요청사항: "${extraRequest}"`
      : "각 과목의 특성과 학습 단계(기초/심화/마무리)에 맞게 할 일(task)을 구체적이고 실용적으로 작성해주세요."}

      다음은 각 과목 및 학습 단계별로 필요한 일별 학습 주제(task)의 개수입니다:
      ${JSON.stringify(counts, null, 2)}
      ${PROMPT_TAIL}
  `;

  const ai = new GoogleGenAI({ apiKey });
  // 검색 그라운딩(googleSearch)은 유료 등급 전용이라 쓰지 않는다.
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  const text = response.text;
  if (!text) throw new Error("AI 응답이 비어있습니다.");
  return text;
}
