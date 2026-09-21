import { GoogleGenAI } from "@google/genai";

/**
 * API 키는 .env 파일에서만 읽는다. 화면에서 입력받지 않는다.
 * VITE_GEMINI_API_KEY 를 기본으로 쓰되, AI Studio 템플릿이 쓰던
 * GEMINI_API_KEY(vite.config 의 define 주입)도 함께 지원한다.
 */
export function getGeminiApiKey(): string {
  const fromImportMeta = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (fromImportMeta) return String(fromImportMeta);

  try {
    if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) {
      return String(process.env.GEMINI_API_KEY);
    }
  } catch {
    /* 브라우저에 process 가 없는 환경 */
  }
  return "";
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

export async function enhanceEventsWithGemini<
  T extends {
    subject: string;
    phase: string;
    task: string;
    referenceLink?: string;
  },
>(
  events: T[],
  goals: string[],
  extraRequest: string,
): Promise<T[]> {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        "Gemini API 키가 설정되지 않았습니다. .env.local 에 VITE_GEMINI_API_KEY 를 넣어주세요.",
      );
    }
    const ai = new GoogleGenAI({ apiKey });

    // Group events by subject and phase to count how many tasks we need
    const subjectPhaseCounts: Record<string, Record<string, number>> = {};
    events.forEach((e) => {
      if (!subjectPhaseCounts[e.subject]) subjectPhaseCounts[e.subject] = {};
      if (!subjectPhaseCounts[e.subject][e.phase])
        subjectPhaseCounts[e.subject][e.phase] = 0;
      subjectPhaseCounts[e.subject][e.phase]++;
    });

    const prompt = `
      사용자의 학습 목표(과목): ${goals.join(", ")}
      ${extraRequest ? `사용자의 추가 요청사항: "${extraRequest}"` : "각 과목의 특성과 학습 단계(기초/심화/마무리)에 맞게 할 일(task)을 구체적이고 실용적으로 작성해주세요."}
      
      다음은 각 과목 및 학습 단계별로 필요한 일별 학습 주제(task)의 개수입니다:
      ${JSON.stringify(subjectPhaseCounts, null, 2)}
      
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
    `;

    // 검색 그라운딩(googleSearch)은 Gemini API 유료 등급 전용이라 쓰지 않는다.
    // 그라운딩 없이 링크를 생성시키면 열리지 않는 주소가 나오므로 프롬프트에서도 링크를 막았다.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    let resultText = response.text;
    if (!resultText) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    // Extract JSON array or object from the response text
    let jsonStr = resultText;
    const arrayMatch = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const objectMatch = resultText.match(/\{\s*"[\s\S]*\}\s*/);

    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    } else if (objectMatch) {
      jsonStr = objectMatch[0];
    } else {
      // Fallback to basic cleanup
      jsonStr = resultText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error(
        "Failed to parse JSON:",
        e,
        "\nOriginal Text:",
        resultText,
        "\nExtracted:",
        jsonStr,
      );
      throw new Error("AI 응답을 분석하는 데 실패했습니다.");
    }

    // Handle case where model wraps array in an object
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.tasks)) {
        parsed = parsed.tasks;
      } else if (Array.isArray(parsed.data)) {
        parsed = parsed.data;
      } else {
        // Try to find any array property
        const arrayProp = Object.values(parsed).find((val) =>
          Array.isArray(val),
        );
        if (arrayProp) {
          parsed = arrayProp;
        } else {
          parsed = [parsed]; // Fallback
        }
      }
    }

    if (!Array.isArray(parsed)) {
      console.error("Parsed result is not an array:", parsed);
      throw new Error("AI 응답 형식이 올바르지 않습니다.");
    }

    // Create a map to easily consume tasks
    const taskMap: Record<string, Record<string, string[]>> = {};
    parsed.forEach((item: any) => {
      const subj = String(item.subject || "").trim();
      const ph = String(item.phase || "").trim();
      if (!taskMap[subj]) taskMap[subj] = {};
      // 모델이 ["주제"] 대신 [{task:"주제"}] 로 답하는 경우도 받아준다
      taskMap[subj][ph] = (item.tasks || [])
        .map((t: any) => (typeof t === "string" ? t : t?.task))
        .filter((t: any): t is string => typeof t === "string" && t.trim().length > 0);
    });

    // Assign tasks back to events
    const enhancedEvents = events.map((event) => {
      let newTask = event.task;

      const subj = String(event.subject || "").trim();
      const ph = String(event.phase || "").trim();

      if (taskMap[subj] && taskMap[subj][ph] && taskMap[subj][ph].length > 0) {
        // 앞에서부터 하나씩 꺼내 쓴다. 모자라면 규칙 엔진이 만든 기본 문구가 그대로 남는다.
        const assignedTask = taskMap[subj][ph].shift();
        if (assignedTask) newTask = assignedTask;
      }

      return {
        ...event,
        task: newTask,
        aiEnhanced: true,
      };
    });

    return enhancedEvents;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
