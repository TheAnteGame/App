/** Shared engine types — pure data, no I/O. The engine never touches the DB. */

export type GameLite = {
  id: string;
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  kickoffAt: Date;
  status: "scheduled" | "in_progress" | "final" | "postponed" | "canceled";
  winnerTeamId: number | null; // null until final; null on a final = TIE
};

export type PickLite = {
  userId: string;
  week: number;
  teamId: number;
  wager: number;
};

export type WagerRules = {
  min: number; // 100 regular season
  max: number; // 1000
  isOvertime: boolean; // overtime: floor drops to 1 (docs/05 #6)
};

export type SettleOutcome = {
  result: "win" | "loss" | "push" | "void";
  /** signed bankroll delta: +wager, -wager, or 0 */
  delta: number;
  /** team-use consumed? (push/tie: yes; void: preserved unless admin rules otherwise) */
  usageCounts: boolean;
};
