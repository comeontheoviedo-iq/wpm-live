import { getGeminiApiKey } from "./env";

const DEFAULT_MODEL = "gemini-3.6-flash";

function candidateModels(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const list = [
    ...(fromEnv ? [fromEnv] : []),
    DEFAULT_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];
  return [...new Set(list)];
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

export type GenerateResult = {
  text: string;
  stub: boolean;
  model?: string;
  grounded?: boolean;
  searchQueries?: string[];
};

export type GenerateOptions = {
  /** Enable Grounding with Google Search. */
  googleSearch?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Fetch abort timeout (ms). */
  timeoutMs?: number;
};

function isModelUnavailable(status: number, errText: string): boolean {
  if (status === 404) return true;
  const lower = errText.toLowerCase();
  return (
    lower.includes("no longer available") ||
    lower.includes("not found") ||
    lower.includes("is not found")
  );
}

async function callGeminiModel(
  key: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions
): Promise<GenerateResult> {
  const useSearch = options.googleSearch !== false;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n---\n\n${userPrompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }

  const timeoutMs = options.timeoutMs ?? (useSearch ? 120_000 : 60_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      String(e).toLowerCase().includes("abort");
    if (useSearch) {
      // Retry once without Google Search on timeout / network failure
      return callGeminiModel(key, model, systemPrompt, userPrompt, {
        ...options,
        googleSearch: false,
        timeoutMs: 60_000,
      });
    }
    throw new Error(
      aborted
        ? `Gemini timeout after ${timeoutMs}ms`
        : `Gemini network error: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (useSearch && (res.status === 400 || res.status === 429 || res.status >= 500)) {
      return callGeminiModel(key, model, systemPrompt, userPrompt, {
        ...options,
        googleSearch: false,
        timeoutMs: 60_000,
      });
    }
    const err = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`) as Error & {
      status?: number;
      body?: string;
    };
    err.status = res.status;
    err.body = errText;
    throw err;
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: {
        webSearchQueries?: string[];
        groundingChunks?: unknown[];
      };
    }[];
  };
  const candidate = json.candidates?.[0];
  const text =
    candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  const queries = candidate?.groundingMetadata?.webSearchQueries || [];
  const grounded = Boolean(
    queries.length || candidate?.groundingMetadata?.groundingChunks?.length
  );

  return {
    text: text.trim() || "(empty response)",
    stub: false,
    model,
    grounded,
    searchQueries: queries,
  };
}

export async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const key = getGeminiApiKey();
  if (!key) {
    return {
      stub: true,
      text: [
        "[Gemini not connected]",
        "Set GEMINI_API_KEY in your .env to generate this section.",
        "",
        "Prompt preview:",
        userPrompt.slice(0, 1200),
      ].join("\n"),
    };
  }

  const models = candidateModels();
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await callGeminiModel(key, model, systemPrompt, userPrompt, options);
    } catch (e) {
      const err = e as Error & { status?: number; body?: string };
      lastError = err;
      const status = err.status ?? 0;
      const body = err.body || err.message || "";
      if (isModelUnavailable(status, body)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini: no candidate models available");
}
