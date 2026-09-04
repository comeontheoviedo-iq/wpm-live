/** Public helpers for optional third-party keys. Never invent keys. */

export function getApiFootballKey(): string | null {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  return key ? key : null;
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export function hasApiFootball(): boolean {
  return Boolean(getApiFootballKey());
}

export function hasGemini(): boolean {
  return Boolean(getGeminiApiKey());
}

export function integrationStatus() {
  return {
    apiFootball: hasApiFootball(),
    gemini: hasGemini(),
  };
}
