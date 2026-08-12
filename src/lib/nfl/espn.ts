import { z } from "zod";

/**
 * ESPN public scoreboard API → normalized game rows (docs/03 NFL data).
 * Everything ingested funnels through normalizeEspnEvent so a provider swap
 * (or admin manual entry) writes through the same shape. Our own game IDs are
 * stable; `espn_event_id` is only an external reference.
 */

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

/** ESPN team abbreviations that differ from ours (nfl_teams.abbr). */
const ABBR_FIXUPS: Record<string, string> = {
  WAS: "WSH", // ESPN has used both over the years; normalize either way
  LA: "LAR",
};

export function normalizeAbbr(espnAbbr: string): string {
  const upper = espnAbbr.toUpperCase();
  return ABBR_FIXUPS[upper] ?? upper;
}

/** Map ESPN event status → our game_status enum. */
export function normalizeStatus(espnState: string, detail?: string): string {
  const d = (detail ?? "").toLowerCase();
  if (d.includes("postponed")) return "postponed";
  if (d.includes("canceled") || d.includes("cancelled")) return "canceled";
  switch (espnState) {
    case "pre":
      return "scheduled";
    case "in":
      return "in_progress";
    case "post":
      return "final";
    default:
      return "scheduled";
  }
}

const competitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  score: z.string().optional(),
  winner: z.boolean().optional(),
  team: z.object({ abbreviation: z.string() }),
});

const eventSchema = z.object({
  id: z.string(),
  date: z.string(),
  competitions: z
    .array(
      z.object({
        competitors: z.array(competitorSchema).min(2),
        status: z.object({
          type: z.object({
            state: z.string(),
            detail: z.string().optional(),
            completed: z.boolean().optional(),
          }),
        }),
      }),
    )
    .min(1),
});

const scoreboardSchema = z.object({
  events: z.array(eventSchema).default([]),
});

export type NormalizedGame = {
  espn_event_id: string;
  season: number;
  week: number;
  home_abbr: string;
  away_abbr: string;
  kickoff_at: string; // ISO UTC
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner_abbr: string | null; // null until final; null on tie
};

export function normalizeEspnEvent(
  event: z.infer<typeof eventSchema>,
  season: number,
  week: number,
): NormalizedGame {
  const comp = event.competitions[0];
  const home = comp.competitors.find((c) => c.homeAway === "home")!;
  const away = comp.competitors.find((c) => c.homeAway === "away")!;
  const status = normalizeStatus(
    comp.status.type.state,
    comp.status.type.detail,
  );
  const isFinal = status === "final";

  let winner: string | null = null;
  if (isFinal) {
    if (home.winner) winner = normalizeAbbr(home.team.abbreviation);
    else if (away.winner) winner = normalizeAbbr(away.team.abbreviation);
    // neither flagged → tie → winner stays null (regular-season tie = PUSH)
  }

  return {
    espn_event_id: event.id,
    season,
    week,
    home_abbr: normalizeAbbr(home.team.abbreviation),
    away_abbr: normalizeAbbr(away.team.abbreviation),
    kickoff_at: new Date(event.date).toISOString(),
    status,
    home_score: isFinal || status === "in_progress" ? Number(home.score ?? 0) : null,
    away_score: isFinal || status === "in_progress" ? Number(away.score ?? 0) : null,
    winner_abbr: winner,
  };
}

/** Fetch one regular-season week (seasontype=2) from ESPN and normalize it. */
export async function fetchWeek(
  season: number,
  week: number,
): Promise<NormalizedGame[]> {
  const url = `${SCOREBOARD_URL}?seasontype=2&week=${week}&dates=${season}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ESPN fetch failed (season ${season} week ${week}): HTTP ${res.status}`);
  }
  const parsed = scoreboardSchema.parse(await res.json());
  return parsed.events.map((e) => normalizeEspnEvent(e, season, week));
}
