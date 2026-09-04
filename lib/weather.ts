/**
 * Open-Meteo helpers (no API key) — geocode city + hourly weather at kickoff.
 */

export type WeatherSnapshot = {
  summary: string;
  tempC: number;
  windKph: number;
  humidity: number;
  lat: number;
  lon: number;
};

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm + hail",
  99: "Thunderstorm + hail",
};

export async function geocodeCity(
  city: string,
  countryHint?: string | null
): Promise<{ lat: number; lon: number; name: string } | null> {
  const q = [city, countryHint].filter(Boolean).join(", ");
  if (!q.trim()) return null;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string; country?: string }[];
    };
    const results = json.results || [];
    if (!results.length) return null;
    if (countryHint) {
      const hit = results.find((r) =>
        (r.country || "").toLowerCase().includes(String(countryHint).toLowerCase())
      );
      if (hit) return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
    }
    const first = results[0];
    return { lat: first.latitude, lon: first.longitude, name: first.name };
  } catch {
    return null;
  }
}

export async function fetchWeatherAtKickoff(
  lat: number,
  lon: number,
  kickoff: Date
): Promise<WeatherSnapshot | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");
  // Open-Meteo forecast window is limited; also try archive for past kickoffs
  const isoDate = kickoff.toISOString().slice(0, 10);
  url.searchParams.set("start_date", isoDate);
  url.searchParams.set("end_date", isoDate);

  try {
    let res = await fetch(url.toString(), { cache: "no-store" });
    let json = (await res.json()) as {
      hourly?: {
        time: string[];
        temperature_2m: number[];
        relative_humidity_2m: number[];
        wind_speed_10m: number[];
        weather_code: number[];
      };
      error?: boolean;
      reason?: string;
    };

    if (!res.ok || json.error || !json.hourly?.time?.length) {
      // Archive API for historical
      const arch = new URL("https://archive-api.open-meteo.com/v1/archive");
      arch.searchParams.set("latitude", String(lat));
      arch.searchParams.set("longitude", String(lon));
      arch.searchParams.set(
        "hourly",
        "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
      );
      arch.searchParams.set("wind_speed_unit", "kmh");
      arch.searchParams.set("timezone", "auto");
      arch.searchParams.set("start_date", isoDate);
      arch.searchParams.set("end_date", isoDate);
      res = await fetch(arch.toString(), { cache: "no-store" });
      json = (await res.json()) as typeof json;
    }

    const hourly = json.hourly;
    if (!hourly?.time?.length) return null;

    const targetMs = kickoff.getTime();
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < hourly.time.length; i++) {
      const t = new Date(hourly.time[i]).getTime();
      const dist = Math.abs(t - targetMs);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const code = hourly.weather_code[bestIdx] ?? 0;
    const tempC = Number(hourly.temperature_2m[bestIdx]);
    const windKph = Number(hourly.wind_speed_10m[bestIdx]);
    const humidity = Math.round(Number(hourly.relative_humidity_2m[bestIdx]));
    if (![tempC, windKph, humidity].every(Number.isFinite)) return null;

    return {
      summary: WMO[code] || `Code ${code}`,
      tempC: Math.round(tempC * 10) / 10,
      windKph: Math.round(windKph * 10) / 10,
      humidity,
      lat,
      lon,
    };
  } catch {
    return null;
  }
}

export async function resolveWeatherForVenue(opts: {
  city: string;
  countryHint?: string | null;
  lat?: number | null;
  lon?: number | null;
  kickoff: Date;
}): Promise<WeatherSnapshot | null> {
  let lat = opts.lat ?? null;
  let lon = opts.lon ?? null;
  if (lat == null || lon == null) {
    const geo = await geocodeCity(opts.city, opts.countryHint);
    if (!geo) return null;
    lat = geo.lat;
    lon = geo.lon;
  }
  return fetchWeatherAtKickoff(lat, lon, opts.kickoff);
}
