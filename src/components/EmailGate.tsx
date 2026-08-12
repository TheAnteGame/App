"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { VOCAB } from "@/lib/brand";

type Stage = "email" | "code";

/**
 * Combined sign-in / sign-up with a single email field (wireframes 1–2):
 * existing users get a code and go straight in; new emails are signed up and
 * continue to profile completion. Passwordless, always. Built on Clerk v7's
 * future API (signIn.emailCode / signUp.verifications).
 */
export default function EmailGate() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [stage, setStage] = useState<Stage>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signIn || !signUp) return null;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const addr = email.trim().toLowerCase();

    // Existing account first…
    const { error: inErr } = await signIn!.emailCode.sendCode({ emailAddress: addr });
    if (!inErr) {
      setMode("signin");
      setStage("code");
      setBusy(false);
      return;
    }

    if (inErr.code === "form_identifier_not_found") {
      // …new player: take a seat.
      const { error: upErr } = await signUp!.create({ emailAddress: addr });
      if (!upErr) {
        const { error: sendErr } = await signUp!.verifications.sendEmailCode();
        if (!sendErr) {
          setMode("signup");
          setStage("code");
          setBusy(false);
          return;
        }
      }
      setError("Couldn't start signup with that email. Double-check it?");
    } else {
      setError("Something went sideways sending your code. Try again.");
    }
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const c = code.trim();

    if (mode === "signin") {
      const { error: vErr } = await signIn!.emailCode.verifyCode({ code: c });
      if (!vErr) {
        await signIn!.finalize();
        router.push("/dashboard");
        return;
      }
    } else {
      const { error: vErr } = await signUp!.verifications.verifyEmailCode({ code: c });
      if (!vErr) {
        await signUp!.finalize();
        router.push("/welcome");
        return;
      }
    }
    setError("Wrong or expired code. Check the email and retry.");
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div
        key={stage} // remount triggers the slide-in animation on stage change
        className="animate-[gate-in_.35s_ease-out]"
      >
        {stage === "email" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <div className="flex overflow-hidden rounded-xl border border-gold/40 bg-surface-card/80 backdrop-blur-sm focus-within:border-gold">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent px-4 py-3.5 text-base text-ink outline-none placeholder:text-ink-muted/50"
              />
              <button
                type="submit"
                disabled={busy}
                aria-label="Continue"
                className="display px-5 text-xl font-bold text-gold transition hover:bg-gold hover:text-surface disabled:opacity-40"
              >
                {busy ? "…" : "→"}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted/70">
              We&apos;ll email you a 6-digit code — no passwords here. By
              continuing you agree to receive league emails. Free to enter; not
              a gambling service.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-ink-muted">
              Code sent to <span className="text-ink">{email}</span>
            </p>
            <div className="flex overflow-hidden rounded-xl border border-gold/40 bg-surface-card/80 backdrop-blur-sm focus-within:border-gold">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="num w-full bg-transparent px-4 py-3.5 text-center text-xl tracking-[0.4em] text-ink outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-ink-muted/50"
              />
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="display px-5 text-base font-bold uppercase text-gold transition hover:bg-gold hover:text-surface disabled:opacity-40"
              >
                {busy ? "…" : VOCAB.submit}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
                setError(null);
              }}
              className="text-xs text-ink-muted underline-offset-2 hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-loss">{error}</p>}
      {/* Clerk bot-protection mount point (invisible unless challenged) */}
      <div id="clerk-captcha" className="mt-3" />
    </div>
  );
}
