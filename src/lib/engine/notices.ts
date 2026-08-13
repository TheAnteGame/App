import type { GameLite } from "./types";

/**
 * Notices ticker engine (docs/01 Page 4): deterministic scenario callouts
 * computed from standings + submissions + the revealed board. Never
 * hand-entered. Pure — trivially testable, no I/O.
 */

export type NoticeKind =
  | "info"
  | "gold"
  | "win"
  | "loss"
  // commissioner ticker colors (custom items from /admin/content)
  | "purple"
  | "orange"
  | "teal"
  | "muted";
export type Notice = { kind: NoticeKind; text: string };

export type TickerStanding = {
  userId: string;
  name: string; // display name ("Robert T.")
  bankroll: number;
  rank: number;
  eliminated: boolean;
};

export type TickerPick = {
  userId: string;
  teamId: number;
  teamName: string;
  wager: number;
  isGhost: boolean;
  auto: boolean;
  result: string | null; // win | loss | push | void | null (unsettled)
  gameId: string;
};

export type TickerInput = {
  weekNumber: number;
  state: "upcoming" | "revealed" | "settled";
  lockAtIso: string;
  nowIso: string;
  standings: TickerStanding[];
  /** Pre-reveal: who has anted (names only — never picks). */
  antedUserIds: string[];
  /** Post-reveal only; [] before reveal. */
  board: TickerPick[];
  games: GameLite[];
};

const byBankrollDesc = (a: TickerStanding, b: TickerStanding) => b.bankroll - a.bankroll;

export function buildNotices(input: TickerInput): Notice[] {
  const out: Notice[] = [];
  const active = input.standings.filter((s) => !s.eliminated);
  const nameOf = new Map(input.standings.map((s) => [s.userId, s.name]));
  const stackOf = new Map(input.standings.map((s) => [s.userId, s.bankroll]));
  const leader = [...active].sort(byBankrollDesc)[0];

  if (input.state === "upcoming") {
    const anted = new Set(input.antedUserIds);
    const inCount = active.filter((s) => anted.has(s.userId)).length;
    const waiting = active.length - inCount;
    if (active.length > 0) {
      out.push({
        kind: "info",
        text: `Week ${input.weekNumber}: ${inCount} of ${active.length} antes are in`,
      });
      if (waiting > 0 && waiting <= 3) {
        const names = active
          .filter((s) => !anted.has(s.userId))
          .map((s) => s.name)
          .join(", ");
        out.push({ kind: "gold", text: `Waiting on ${names} — reveal fires the moment the last ante lands` });
      } else if (waiting === 0 && active.length > 1) {
        out.push({ kind: "gold", text: "Everyone's in — reveal is imminent" });
      }
    }
    const msLeft = new Date(input.lockAtIso).getTime() - new Date(input.nowIso).getTime();
    if (msLeft > 0 && msLeft <= 3 * 3600_000) {
      const h = Math.floor(msLeft / 3600_000);
      const m = Math.floor((msLeft % 3600_000) / 60_000);
      out.push({
        kind: "loss",
        text: `Lock in ${h > 0 ? `${h}h ${m}m` : `${m} minutes`} — the house antes for stragglers`,
      });
    }
    if (leader) {
      out.push({ kind: "info", text: `${leader.name} leads the table with ${leader.bankroll}` });
    }
    return out;
  }

  // Revealed / settled: the board is public.
  const livePicks = input.board.filter((p) => !p.isGhost);
  const gameById = new Map(input.games.map((g) => [g.id, g]));

  if (input.state === "revealed") {
    out.push({ kind: "gold", text: "Antes are in." });

    for (const p of livePicks) {
      if (p.result) continue; // settled picks get result callouts below
      const stack = stackOf.get(p.userId) ?? 0;
      const name = nameOf.get(p.userId) ?? "?";
      // Wager can never exceed the stack, so all-in IS elimination risk.
      if (p.wager >= stack && stack > 0) {
        out.push({ kind: "loss", text: `${name} is ALL-IN on the ${p.teamName} — a loss means BUSTED` });
      }
      if (leader && p.userId !== leader.userId && stack + p.wager > leader.bankroll) {
        out.push({ kind: "win", text: `${name} takes the lead with a ${p.teamName} win` });
      }
      if (p.auto) {
        out.push({ kind: "info", text: `AUTO-ANTE: the house put ${nameOf.get(p.userId)} on the ${p.teamName}` });
      }
    }

    // Biggest possible mover (max unsettled wager).
    const unsettled = livePicks.filter((p) => !p.result);
    if (unsettled.length > 0) {
      const big = unsettled.reduce((a, b) => (b.wager > a.wager ? b : a));
      out.push({
        kind: "gold",
        text: `Biggest swing on the board: ${nameOf.get(big.userId)} with ${big.wager} riding on the ${big.teamName}`,
      });
    }

    // Shared fates.
    const byTeam = new Map<number, TickerPick[]>();
    for (const p of unsettled) {
      byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
    }
    for (const [, group] of [...byTeam.entries()].sort((a, b) => a[0] - b[0])) {
      if (group.length >= 2) {
        out.push({
          kind: "info",
          text: `${group.map((p) => nameOf.get(p.userId)).join(" and ")} both ride with the ${group[0].teamName}`,
        });
      }
    }
  }

  // Result callouts (revealed with partial finals, or fully settled).
  for (const p of livePicks) {
    if (!p.result) continue;
    const name = nameOf.get(p.userId) ?? "?";
    if (p.result === "win") out.push({ kind: "win", text: `${name} cashed +${p.wager} on the ${p.teamName}` });
    if (p.result === "loss") {
      const busted = (stackOf.get(p.userId) ?? 1) <= 0;
      out.push(
        busted
          ? { kind: "loss", text: `${name} went bust on the ${p.teamName} — BUSTED` }
          : { kind: "loss", text: `${name} dropped ${p.wager} on the ${p.teamName}` },
      );
    }
    if (p.result === "push") out.push({ kind: "info", text: `${name} pushes — tie game, stack intact` });
    if (p.result === "void") out.push({ kind: "info", text: `${name}'s game was canceled — ante returned` });
  }

  // Games still to be decided.
  if (input.state === "revealed") {
    const pendingGames = new Set(
      livePicks.filter((p) => !p.result).map((p) => gameById.get(p.gameId)).filter(Boolean),
    );
    if (pendingGames.size > 0) {
      out.push({ kind: "info", text: `${pendingGames.size} game${pendingGames.size > 1 ? "s" : ""} left to decide the week` });
    }
  }

  if (input.state === "settled" && leader) {
    out.push({ kind: "gold", text: `Week ${input.weekNumber} is in the books — ${leader.name} leads with ${leader.bankroll}` });
    const secondPlace = [...active].sort(byBankrollDesc)[1];
    if (secondPlace && leader.bankroll - secondPlace.bankroll <= 200) {
      out.push({ kind: "info", text: `${secondPlace.name} is only ${leader.bankroll - secondPlace.bankroll} back` });
    }
  }

  return out;
}
