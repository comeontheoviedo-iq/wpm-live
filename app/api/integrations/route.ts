import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

export async function GET() {
  const status = integrationStatus();
  return NextResponse.json({
    ...status,
    hint: "After editing .env / .env.local, restart the Next.js server (npm run dev).",
  });
}
