import { getGeminiApiKey } from "./env";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}

export type GenerateResult = {
  text: string;
  stub: boolean;
  model?: string;
};

export async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";

  return { text: text.trim() || "(empty response)", stub: false, model: MODEL };
}
