/**
 * Netlify scheduled function — every 2 minutes (UTC).
 * Thin caller into Next.js cron route so we reuse Prisma + full sync.
 * Only runs on published production deploys.
 */
export default async () => {
  const base =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    "";
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";

  if (!base) {
    console.error("[pre-kickoff-hard-sync] No URL env for site base");
    return new Response(JSON.stringify({ error: "missing URL" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  if (!secret) {
    console.error(
      "[pre-kickoff-hard-sync] CRON_SECRET/AUTH_SECRET not set — refusing"
    );
    return new Response(JSON.stringify({ error: "missing secret" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const endpoint = new URL("/api/cron/pre-kickoff-hard-sync", base).toString();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  console.log(
    `[pre-kickoff-hard-sync] ${res.status} ${text.slice(0, 500)}`
  );

  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const config = {
  schedule: "*/2 * * * *",
};
