import Image from "next/image";
import { BRAND, VOCAB } from "@/lib/brand";

/**
 * Page 1 — Sign Up / Login (wireframe 1).
 * Phase 0 placeholder: layout + copy per spec; the email OTP form activates in
 * Phase 1 once Clerk keys exist. Centered single column, logo, short intro,
 * email field with inline fine print, submit arrow, copyright.
 */
export default function Home() {
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <Image
          src={BRAND.logoOnDark}
          alt={BRAND.name}
          width={180}
          height={120}
          priority
          className="mx-auto mb-8 h-auto w-40"
        />
        <h1 className="mb-3 text-3xl font-bold tracking-tight">{BRAND.name}</h1>
        <p className="mb-10 text-sm leading-relaxed text-ink-muted">
          A season-long NFL points pool. Everyone starts with a 1,000-point
          stack, picks one team to win outright each week, and antes 100–1,000
          points. Highest bankroll after Week 18 is the {VOCAB.champion.toLowerCase()}.
        </p>

        {clerkReady ? (
          // Phase 1: replace with the Clerk email-OTP flow (slide transitions per spec)
          <p className="text-sm text-gold">Login flow arrives in Phase 1.</p>
        ) : (
          <div className="rounded-xl border border-edge bg-surface-card p-6">
            <p className="text-sm text-ink-muted">
              {VOCAB.signupCta} — signups open soon.
            </p>
          </div>
        )}

        <p className="mt-12 text-xs text-ink-muted/60">
          Free-to-enter game of skill. No purchase necessary. ©{" "}
          {new Date().getFullYear()} {BRAND.name}.
        </p>
      </div>
    </main>
  );
}
