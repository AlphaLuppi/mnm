import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require onboarding check
const PUBLIC_PATHS = ["/onboarding", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.includes("_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check onboarding status from cookie
  const onboardingComplete = request.cookies.get("mnm-onboarding-complete");

  if (!onboardingComplete) {
    // Redirect to onboarding
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
  ],
};
