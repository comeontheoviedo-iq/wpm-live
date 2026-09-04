import { NextResponse } from "next/server";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  let list = PRIORITY_COMPETITIONS;
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.broadcastName.toLowerCase().includes(q)
    );
  }
  return NextResponse.json({ competitions: list });
}
