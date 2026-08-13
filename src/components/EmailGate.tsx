"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { VOCAB } from "@/lib/brand";

type Stage = "email" | "code";

export type EmailGateLabels = {
  emailPlaceholder: string;
  emailFine: string;
  codeSentPrefix: string;
  codePlaceholder: string;
  useDifferentEmail: string;
};

const DEFAULT_LABELS: EmailGateLabels = {
  emailPlaceholder: "your@email.com",
  emailFine:
    "We'll email you a 6-digit code — no passwords here. By continuing you agree to receive league emails. Free to enter; not a gambling service.",
  codeSentPrefix: "Code sent to",
  codePlaceholder: "6-digit code",
  useDifferentEmail: "Use a different email",
};

/**
 * Combined sign-in / sign-up with a single email field (wireframes 1–2):
 * existing users get a code and go straight in; new emails are signed up and
 * continue to profile completion. Passwordless, always. Built on Clerk v7's
 * future API (signIn.emailCode / signUp.verifications). Labels are
 * commissioner-editable (passed from the server page via site_content).
 */
export default function EmailGate({
  labels = DEFAULT_LABELS,
}: {
  labels?: EmailGateLabels;
}) {
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

    // Clerk errors may carry the code at the top level or nested in .errors[]
    const codesOf = (err: unknown): string[] => {
      const e = err as { code?: string; errors?: { code?: string }[] };
      return [e.code, ...(e.errors?.map((x) => x.code) ?? [])].filter(
        Boolean,
      ) as string[];
    };
    const msgOf = (err: unknown): string => {
      const e = err as {
        longMessage?: string;
        message?: string;
        errors?: { longMessage?: string; message?: string }[];
      };
      return (
        e.longMessage ??
        e.errors?.[0]?.longMessage ??
        e.message ??
        e.errors?.[0]?.message ??
        "unknown error"
      );
    };
    console.error("[ante] signIn sendCode error", inErr);

    if (codesOf(inErr).includes("form_identifier_not_found")) {
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
        console.error("[ante] signUp sendEmailCode error", sendErr);
        setError(`Couldn't send your code: ${msgOf(sendErr)}`);
      } else {
        console.error("[ante] signUp create error", upErr);
        setError(`Couldn't start signup: ${msgOf(upErr)}`);
      }
    } else {
      setError(`Couldn't send your code: ${msgOf(inErr)}`);
    }
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const c = code.trim();
    const describe = (err: unknown): string => {
      const x = err as {
        longMessage?: string;
        message?: string;
        code?: string;
        errors?: { longMessage?: string; message?: string; code?: string }[];
      };
      return (
        x.longMessage ??
        x.errors?.[0]?.longMessage ??
        x.message ??
        x.errors?.[0]?.message ??
        x.code ??
        "unknown error"
      );
    };

    try {
      if (mode === "signin") {
        const { error: vErr } = await signIn!.emailCode.verifyCode({ code: c });
        if (vErr) {
          console.error("[ante] verifyCode error", vErr);
          setError(`Code check failed: ${describe(vErr)}`);
          setBusy(false);
          return;
        }
        const { error: fErr } = await signIn!.finalize();
        if (fErr) {
          console.error("[ante] signIn finalize error", fErr);
          setError(`Almost there, but the session didn't start: ${describe(fErr)}`);
          setBusy(false);
          return;
        }
        // Hard navigation so the fresh session reaches the server on first load
        window.location.assign("/dashboard");
        return;
      }

      const { error: vErr } = await signUp!.verifications.verifyEmailCode({ code: c });
      if (vErr) {
        console.error("[ante] verifyEmailCode error", vErr);
        setError(`Code check failed: ${describe(vErr)}`);
        setBusy(false);
        return;
      }
      const { error: fErr } = await signUp!.finalize();
      if (fErr) {
        console.error("[ante] signUp finalize error", fErr, "status:", signUp!.status);
        setError(`Almost there, but the account didn't finalize: ${describe(fErr)}`);
        setBusy(false);
        return;
      }
      window.location.assign("/welcome");
    } catch (err) {
      console.error("[ante] verify threw", err);
      setError(`Unexpected error: ${describe(err)}`);
      setBusy(false);
    }
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
                placeholder={labels.emailPlaceholder}
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
            <p className="text-xs leading-relaxed text-ink-muted/70">{labels.emailFine}</p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-ink-muted">
              {labels.codeSentPrefix} <span className="text-ink">{email}</span>
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
                placeholder={labels.codePlaceholder}
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
              {labels.useDifferentEmail}
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
