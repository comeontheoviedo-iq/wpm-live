import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/login", "/pricing"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isPublic =
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname === "/";

  const token = req.cookies.get("pitchline_session")?.value;
  let authed = false;
  if (token) {
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(
          process.env.AUTH_SECRET || "pitchline-demo-secret-change-in-prod"
        )
      );
      authed = true;
    } catch {
      authed = false;
    }
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(authed ? "/dashboard" : "/login", req.url)
    );
  }

  if (!authed && !isPublic && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
