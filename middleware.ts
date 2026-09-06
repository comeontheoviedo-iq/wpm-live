import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/login", "/pricing"];

/** OBS Browser Source has no login cookie — allow transparent overlay pages. */
function isObsOverlayPath(pathname: string) {
  return (
    pathname === "/overlay" ||
    pathname.endsWith("/overlay") ||
    pathname.includes("/overlay/")
  );
}

function withPathname(req: NextRequest, res: NextResponse) {
  // Request header so server layouts can read via headers()
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  // Rebuild next() responses with the mutated request headers.
  if (res.status >= 300 && res.status < 400) {
    // redirects — keep as-is; overlay detection only needed for page renders
    return res;
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return withPathname(req, NextResponse.next());
  }

  const isPublic =
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname === "/" ||
    isObsOverlayPath(pathname);

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

  return withPathname(req, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
