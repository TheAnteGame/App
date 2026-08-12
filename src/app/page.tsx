import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BRAND, VOCAB } from "@/lib/brand";
import EmailGate from "@/components/EmailGate";

/**
 * Page 1 — Sign Up / Login (wireframe 1).
 * Centered single column on the animated "casino stage" backdrop. Logo carries
 * the brand name, so the headline is a sales hook instead of repeating it.
 */
export default async function Home() {
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (clerkReady) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      {/* Animated backdrop */}
      <div className="stage" aria-hidden="true">
        <div className="stage-blob stage-blob--purple" />
        <div className="stage-blob stage-blob--red" />
        <div className="stage-blob stage-blob--teal" />
        <div className="stage-blob stage-blob--gold" />
        <div className="stage-sweep" />
        <div className="stage-glitter" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl text-center">
        <Image
          src={BRAND.logoOnDark}
          alt={BRAND.name}
          width={640}
          height={430}
          priority
          className="mx-auto mb-10 h-auto w-72 drop-shadow-[0_0_45px_rgba(229,163,61,0.25)] sm:w-80"
        />

        <h1 className="display mb-6 text-4xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-5xl">
          Can your stack survive{" "}
          <span className="text-gold">18 weeks</span>?
        </h1>

        <p className="mx-auto mb-12 max-w-lg text-lg leading-relaxed text-ink-muted sm:text-xl">
          A season-long NFL points pool. Start with 1,000 points, back one team
          to win outright each week, and ante 100–1,000 on your gut. Highest
          bankroll after Week 18 is the {VOCAB.champion.toLowerCase()}.
        </p>

        {clerkReady ? (
          <EmailGate />
        ) : (
          <div className="mx-auto max-w-sm rounded-2xl border border-edge bg-surface-card/70 p-6 backdrop-blur-sm">
            <p className="text-base text-ink-muted">
              {VOCAB.signupCta} — signups open soon.
            </p>
          </div>
        )}

        <p className="mt-14 text-xs text-ink-muted/60">
          Free-to-enter game of skill. No purchase necessary. ©{" "}
          {new Date().getFullYear()} {BRAND.name}.
        </p>
      </div>
    </main>
  );
}
