import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk middleware activates only when keys exist, so the app deploys before
 * the Clerk account is set up (Phase 0).
 * Protected: everything signed-in. Public: landing page + job routes (those
 * carry their own CRON_SECRET auth). Role checks happen in the pages (the
 * users table owns role/status, not Clerk).
 */
const isPublic = createRouteMatcher(["/", "/api/jobs(.*)"]);

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) await auth.protect({ unauthenticatedUrl: new URL("/", req.url).toString() });
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
