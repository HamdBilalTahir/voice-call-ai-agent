import { NextRequest, NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_PREFIXES = ["/login", "/api/", "/_next/", "/favicon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.cookies.get("__session");
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files and images
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
