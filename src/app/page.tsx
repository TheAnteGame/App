import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BRAND, VOCAB } from "@/lib/brand";
import { getContent, headlineParts } from "@/lib/content";
import EmailGate from "@/components/EmailGate";

export const dynamic = "force-dynamic";

/**
 * Page 1 — Sign Up / Login (wireframe 1).
 * Copy is commissioner-editable via /admin/content (site_content overrides,
 * shipped defaults otherwise). *stars* in the headline render gold.
 */
export default async function Home() {
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (clerkReady) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }
  const c = await getContent();

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
          {headlineParts(c["landing.headline"]).map((p, i) =>
            p.gold ? (
              <span key={i} className="text-gold">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </h1>

        <p className="mx-auto mb-12 max-w-lg text-lg leading-relaxed text-ink-muted sm:text-xl">
          {c["landing.intro"]}
        </p>

        {clerkReady ? (
          <EmailGate
            labels={{
              emailPlaceholder: c["landing.emailPlaceholder"],
              emailFine: c["landing.emailFine"],
              codeSentPrefix: c["landing.codeSentPrefix"],
              codePlaceholder: c["landing.codePlaceholder"],
              useDifferentEmail: c["landing.useDifferentEmail"],
            }}
          />
        ) : (
          <div className="mx-auto max-w-sm rounded-2xl border border-edge bg-surface-card/70 p-6 backdrop-blur-sm">
            <p className="text-base text-ink-muted">
              {VOCAB.signupCta} — signups open soon.
            </p>
          </div>
        )}

        <p className="mt-14 text-xs text-ink-muted/60">
          {c["landing.footer"]} © {new Date().getFullYear()} {BRAND.name}.
        </p>
      </div>
    </main>
  );
}
