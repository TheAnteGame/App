import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/db";
import { getContent, getTickerItems } from "@/lib/content";
import {
  TickerManager,
  TextGroupForm,
  RichSectionForm,
  ResetButton,
} from "./ContentEditors";

export const dynamic = "force-dynamic";

/**
 * Commissioner content studio: custom ticker notices (with brand colors) and
 * every piece of editable site copy — landing, login stages, welcome, pending,
 * and the three rich How-to-Play sections. Everything falls back to the
 * shipped defaults; "reset" simply deletes the overrides.
 */
export default async function ContentStudio() {
  const user = await requireUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const [c, ticker] = await Promise.all([getContent(), getTickerItems(true)]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="display text-3xl font-bold uppercase">Content studio</h1>
        <nav className="flex gap-4 text-sm text-ink-muted">
          <Link href="/admin" className="hover:text-ink">← Commissioner</Link>
          <Link href="/dashboard" className="hover:text-ink">The table</Link>
        </nav>
      </header>

      {/* ---- Ticker ---- */}
      <section className="panel mb-6 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="display text-xl font-semibold uppercase">Ticker notices</h2>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          Your notices scroll ahead of the automatic callouts (antes in, all-ins,
          results). Order sorts low→high; untick &quot;live&quot; to bench one without
          deleting it.
        </p>
        <TickerManager items={ticker} />
      </section>

      {/* ---- Landing page ---- */}
      <section className="panel mb-6 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="display text-xl font-semibold uppercase">Landing page</h2>
          <ResetButton target="landing" label="reset landing to defaults" />
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          In the headline, wrap words in *stars* to turn them gold.
        </p>
        <TextGroupForm
          fields={[
            { key: "landing.headline", label: "Headline", value: c["landing.headline"] },
            { key: "landing.intro", label: "Intro paragraph", value: c["landing.intro"], multiline: true },
            { key: "landing.emailPlaceholder", label: "Email field placeholder", value: c["landing.emailPlaceholder"] },
            { key: "landing.emailFine", label: "Fine print under the email field", value: c["landing.emailFine"], multiline: true },
            { key: "landing.codeSentPrefix", label: "“Code sent to” prefix", value: c["landing.codeSentPrefix"] },
            { key: "landing.codePlaceholder", label: "Code field placeholder", value: c["landing.codePlaceholder"] },
            { key: "landing.useDifferentEmail", label: "“Use a different email” link", value: c["landing.useDifferentEmail"] },
            { key: "landing.footer", label: "Footer line", value: c["landing.footer"] },
          ]}
        />
      </section>

      {/* ---- Welcome + pending ---- */}
      <section className="panel mb-6 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="display text-xl font-semibold uppercase">Take a seat / pending</h2>
          <ResetButton target="welcome" label="reset welcome" />
        </div>
        <TextGroupForm
          fields={[
            { key: "welcome.title", label: "Welcome title", value: c["welcome.title"] },
            { key: "welcome.subtitle", label: "Welcome subtitle", value: c["welcome.subtitle"], multiline: true },
            { key: "welcome.firstPlaceholder", label: "First-name placeholder", value: c["welcome.firstPlaceholder"] },
            { key: "welcome.lastPlaceholder", label: "Last-name placeholder", value: c["welcome.lastPlaceholder"] },
            { key: "welcome.phonePlaceholder", label: "Phone placeholder", value: c["welcome.phonePlaceholder"] },
            { key: "welcome.button", label: "Submit button", value: c["welcome.button"] },
            { key: "pending.title", label: "Pending screen title", value: c["pending.title"] },
            { key: "pending.body", label: "Pending screen body", value: c["pending.body"], multiline: true },
          ]}
        />
      </section>

      {/* ---- How to Play rich sections ---- */}
      <section className="panel mb-6 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="display text-xl font-semibold uppercase">How to Play — sections</h2>
          <ResetButton target="howto" label="reset all three sections + titles" />
        </div>
        <TextGroupForm
          fields={[
            { key: "howto.title1", label: "Section 1 title", value: c["howto.title1"] },
            { key: "howto.title2", label: "Section 2 title", value: c["howto.title2"] },
            { key: "howto.title3", label: "Section 3 title", value: c["howto.title3"] },
            { key: "howto.railTitle", label: "Player rail title", value: c["howto.railTitle"] },
            { key: "howto.acceptButton", label: "Accept button", value: c["howto.acceptButton"] },
            { key: "howto.acceptNote", label: "Accept fine print", value: c["howto.acceptNote"] },
          ]}
        />
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="display mb-2 text-base font-semibold uppercase text-gold">
              {c["howto.title1"]}
            </h3>
            <RichSectionForm contentKey="howto.section1Html" initialHtml={c["howto.section1Html"]} />
          </div>
          <div>
            <h3 className="display mb-2 text-base font-semibold uppercase text-gold">
              {c["howto.title2"]}
            </h3>
            <RichSectionForm contentKey="howto.section2Html" initialHtml={c["howto.section2Html"]} />
          </div>
          <div>
            <h3 className="display mb-2 text-base font-semibold uppercase text-gold">
              {c["howto.title3"]}
            </h3>
            <RichSectionForm contentKey="howto.section3Html" initialHtml={c["howto.section3Html"]} />
          </div>
        </div>
      </section>
    </main>
  );
}
