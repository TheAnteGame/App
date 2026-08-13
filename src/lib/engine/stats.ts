/**
 * Fun-stats engine (docs/01 Page 4, docs/02 §9): weekly superlatives + season
 * records from settled picks and standings snapshots. Pure — no I/O.
 */

export type StatPick = {
  userId: string;
  week: number;
  teamName: string;
  wager: number;
  auto: boolean;
  isGhost: boolean;
  result: string | null; // win | loss | push | void | null
};

export type StatSnapshot = { userId: string; week: number; bankroll: number; rank: number };

export type Superlative = {
  key: string;
  title: string;
  detail: string; // "Robert T. — +600 on the Seahawks"
  tone: "win" | "loss" | "gold" | "info";
};

export type StatsInput = {
  names: Map<string, string>;
  picks: StatPick[]; // all season picks (settled + not)
  snapshots: StatSnapshot[];
  lastSettledWeek: number | null;
};

const name = (names: Map<string, string>, id: string) => names.get(id) ?? "?";

export function weeklySuperlatives(input: StatsInput): Superlative[] {
  const out: Superlative[] = [];
  if (input.lastSettledWeek === null) return out;
  const wk = input.picks.filter(
    (p) => p.week === input.lastSettledWeek && !p.isGhost && p.result,
  );
  if (wk.length === 0) return out;

  const wins = wk.filter((p) => p.result === "win");
  if (wins.length > 0) {
    const big = wins.reduce((a, b) => (b.wager > a.wager ? b : a));
    out.push({
      key: "biggest-win",
      title: "Biggest win",
      detail: `${name(input.names, big.userId)} — +${big.wager} on the ${big.teamName}`,
      tone: "win",
    });
  }
  const losses = wk.filter((p) => p.result === "loss");
  if (losses.length > 0) {
    const brutal = losses.reduce((a, b) => (b.wager > a.wager ? b : a));
    out.push({
      key: "toughest-beat",
      title: "Toughest beat",
      detail: `${name(input.names, brutal.userId)} — −${brutal.wager} on the ${brutal.teamName}`,
      tone: "loss",
    });
  }
  const bold = wk.reduce((a, b) => (b.wager > a.wager ? b : a));
  out.push({
    key: "boldest-ante",
    title: "Boldest ante",
    detail: `${name(input.names, bold.userId)} — ${bold.wager} on the ${bold.teamName}`,
    tone: "gold",
  });
  const autos = wk.filter((p) => p.auto);
  if (autos.length > 0) {
    out.push({
      key: "house-guests",
      title: "House anted for",
      detail: autos.map((p) => name(input.names, p.userId)).join(", "),
      tone: "info",
    });
  }
  return out;
}

export function seasonRecords(input: StatsInput): Superlative[] {
  const out: Superlative[] = [];
  const settled = input.picks.filter((p) => !p.isGhost && p.result);
  if (settled.length === 0) return out;

  // Most wins
  const winCount = new Map<string, number>();
  for (const p of settled) if (p.result === "win") winCount.set(p.userId, (winCount.get(p.userId) ?? 0) + 1);
  if (winCount.size > 0) {
    const [uid, n] = [...winCount.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ key: "most-wins", title: "Most wins", detail: `${name(input.names, uid)} — ${n}`, tone: "win" });
  }

  // Riskiest player (highest average ante, min 2 picks)
  const sums = new Map<string, { total: number; n: number }>();
  for (const p of settled) {
    const s = sums.get(p.userId) ?? { total: 0, n: 0 };
    s.total += p.wager;
    s.n += 1;
    sums.set(p.userId, s);
  }
  const risky = [...sums.entries()]
    .filter(([, s]) => s.n >= 2)
    .map(([uid, s]) => [uid, Math.round(s.total / s.n)] as const)
    .sort((a, b) => b[1] - a[1])[0];
  if (risky) {
    out.push({
      key: "riskiest",
      title: "Riskiest player",
      detail: `${name(input.names, risky[0])} — ${risky[1]} average ante`,
      tone: "gold",
    });
  }

  // High-water mark from snapshots
  if (input.snapshots.length > 0) {
    const peak = input.snapshots.reduce((a, b) => (b.bankroll > a.bankroll ? b : a));
    out.push({
      key: "high-water",
      title: "High-water stack",
      detail: `${name(input.names, peak.userId)} — ${peak.bankroll} after Week ${peak.week}`,
      tone: "gold",
    });
  }

  // Longest active win streak
  const byUser = new Map<string, StatPick[]>();
  for (const p of settled) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);
  let streakBest: { uid: string; n: number } | null = null;
  for (const [uid, picks] of byUser) {
    const ordered = [...picks].sort((a, b) => a.week - b.week);
    let cur = 0;
    for (const p of ordered) {
      if (p.result === "win") cur += 1;
      else if (p.result === "loss") cur = 0;
      // push/void: streak survives
    }
    if (cur >= 2 && (!streakBest || cur > streakBest.n)) streakBest = { uid, n: cur };
  }
  if (streakBest) {
    out.push({
      key: "hot-hand",
      title: "Hot hand",
      detail: `${name(input.names, streakBest.uid)} — ${streakBest.n} straight`,
      tone: "win",
    });
  }

  return out;
}
