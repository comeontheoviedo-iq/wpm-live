import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    const user = await authenticate(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    await createSession(user);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[auth/login]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
