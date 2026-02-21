import { NextResponse } from "next/server";

/**
 * Route handler to sync the onboarding cookie when config says complete but cookie is missing.
 * This breaks the 307 redirect loop between middleware and onboarding page.
 */
export async function GET() {
  const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));

  response.cookies.set("mnm-onboarding-complete", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
