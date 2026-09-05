import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePackForMatch } from "@/lib/pack-generate";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const templateKey = String(body.templateKey || "");
    if (!templateKey) {
      return NextResponse.json({ error: "templateKey required" }, { status: 400 });
    }

    const result = await generatePackForMatch({
      matchId: id,
      templateKey,
      userId: session.id,
      sources: body.sources,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[packs/generate]", message);
    const status =
      message === "Match not found" || message === "Unknown template" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
