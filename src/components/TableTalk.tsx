"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { VOCAB } from "@/lib/brand";
import { fetchChat, postChat } from "@/app/dashboard/actions";
import type { ChatMessage } from "@/lib/chat";

/**
 * Table Talk (docs/01 Page 4): one league-wide channel. Posting goes through
 * a server action (membership + mute enforced server-side). Reads: Supabase
 * Realtime with the Clerk JWT (decision #17) triggers instant refreshes, with
 * a slow poll as fallback until the Clerk↔Supabase link is configured.
 */

export default function TableTalk({
  initial,
  meId,
  muted,
}: {
  initial: ChatMessage[];
  meId: string;
  muted: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        setMessages(await fetchChat());
      } catch {
        /* transient — next poll wins */
      }
    });
  }, []);

  // Pin to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Realtime (instant) + slow poll (fallback / drift-healing).
  useEffect(() => {
    let client: SupabaseClient | null = null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      try {
        client = createClient(url, anon, {
          accessToken: async () => (await getToken()) ?? "",
        });
        client
          .channel("table-talk")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "chat_messages" },
            () => refresh(),
          )
          .subscribe();
      } catch {
        client = null; // Clerk↔Supabase not linked yet — polling covers us
      }
    }
    const poll = setInterval(refresh, 20_000);
    return () => {
      clearInterval(poll);
      client?.removeAllChannels();
    };
  }, [getToken, refresh]);

  const send = (formData: FormData) => {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    if (inputRef.current) inputRef.current.value = "";
    setError(null);
    startTransition(async () => {
      const res = await postChat(body);
      if (!res.ok) setError(res.error);
      else setMessages(await fetchChat());
    });
  };

  return (
    <section className="panel flex h-[420px] flex-col p-5 sm:p-6">
      <h2 className="display mb-3 text-xl font-bold uppercase">{VOCAB.chat}</h2>

      <div ref={scrollRef} className="chat-scroll -mx-2 flex-1 space-y-2.5 overflow-y-auto px-2">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-ink-muted">
            Quiet table so far. Say something.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-gold/15 text-ink"
                    : "rounded-bl-sm bg-surface-raised text-ink"
                }`}
              >
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  {m.name}
                  {m.eliminated && <span className="ml-1.5 text-loss">{VOCAB.eliminated}</span>}
                  <span className="ml-2 font-normal normal-case">
                    {new Date(m.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {muted ? (
        <p className="mt-3 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">
          Muted by the commish — you can watch the table, not talk at it.
        </p>
      ) : (
        <form action={send} className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            name="body"
            maxLength={2000}
            autoComplete="off"
            placeholder="Talk your talk…"
            className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted/60 focus:border-gold"
          />
          <button
            type="submit"
            disabled={pending}
            className="display rounded-xl bg-gold px-4 text-sm font-bold uppercase text-surface transition hover:bg-gold-bright disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
      {error && <p className="mt-1.5 text-xs text-loss">{error}</p>}
    </section>
  );
}
