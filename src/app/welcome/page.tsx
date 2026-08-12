import Image from "next/image";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BRAND, VOCAB } from "@/lib/brand";
import { requireUser, profileComplete } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Page 2 — profile completion (wireframe 2). After the email is verified the
 * form slides to first/last/phone; submitting leaves the account Pending and
 * shows the "you're in line" state.
 */
export default async function Welcome() {
  const user = await requireUser();
  if (!user) redirect("/");
  if (profileComplete(user)) redirect("/dashboard");

  async function saveProfile(formData: FormData) {
    "use server";
    const u = await requireUser();
    if (!u) redirect("/");
    const first = String(formData.get("first") ?? "").trim();
    const last = String(formData.get("last") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    if (!first || !last) return;
    await supabaseAdmin()
      .from("users")
      .update({ first_name: first, last_name: last, phone: phone || null })
      .eq("id", u.id);
    revalidatePath("/welcome");
    redirect("/dashboard");
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="stage" aria-hidden="true">
        <div className="stage-blob stage-blob--gold" />
        <div className="stage-sweep" />
      </div>
      <div className="relative z-10 w-full max-w-sm text-center">
        <Image
          src={BRAND.logoOnDark}
          alt={BRAND.name}
          width={640}
          height={430}
          priority
          className="mx-auto mb-8 h-auto w-40"
        />
        <h1 className="display mb-2 text-2xl font-bold uppercase">
          {VOCAB.signupCta}
        </h1>
        <p className="mb-8 text-sm text-ink-muted">
          Tell the table who you are. The commissioner approves every seat.
        </p>
        <form action={saveProfile} className="space-y-3 text-left">
          <input
            name="first"
            required
            placeholder="First name"
            className="w-full rounded-xl border border-edge bg-surface-card/80 px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-ink-muted/50 focus:border-gold"
          />
          <input
            name="last"
            required
            placeholder="Last name"
            className="w-full rounded-xl border border-edge bg-surface-card/80 px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-ink-muted/50 focus:border-gold"
          />
          <input
            name="phone"
            type="tel"
            placeholder="Mobile phone (stored for later — we only email in beta)"
            className="w-full rounded-xl border border-edge bg-surface-card/80 px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-ink-muted/50 focus:border-gold"
          />
          <button
            type="submit"
            className="display w-full rounded-xl bg-gold px-4 py-3.5 text-lg font-bold uppercase text-surface transition hover:bg-gold-bright"
          >
            Take my seat →
          </button>
        </form>
      </div>
    </main>
  );
}
