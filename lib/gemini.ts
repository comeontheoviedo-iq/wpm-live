import { getGeminiApiKey } from "./env";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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
  /** Enable Grounding with Google Search (gemini-2.0-flash google_search tool). */
  googleSearch?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
};

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

  const useSearch = options.googleSearch !== false; // default ON for deep research
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

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
    // Gemini 2.0+: tools: [{ google_search: {} }]
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // If google_search rejected (older key / model), retry once without tools
    if (useSearch && res.status === 400) {
      return generateWithGemini(systemPrompt, userPrompt, {
        ...options,
        googleSearch: false,
      });
    }
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
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
    model: MODEL,
    grounded,
    searchQueries: queries,
  };
}
