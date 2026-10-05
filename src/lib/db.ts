export type GameType =
  | "tictactoe"
  | "connect4"
  | "checkers"
  | "reversi"
  | "chess";

export type GameStatusDb = "active" | "finished" | "abandoned";
export type GameResult = "win" | "draw" | "resign";

export interface ProfileRow {
  id: string;
  display_name: string;
  settings: {
    guide_mode?: boolean;
    show_hints?: boolean;
  };
}

export interface GameRow {
  id: string;
  type: GameType;
  status: GameStatusDb;
  player_a: string;
  player_b: string;
  first_player: string;
  turn: string | null;
  ply: number;
  state: unknown;
  winner: string | null;
  result: GameResult | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UndoRequestRow {
  id: string;
  game_id: string;
  requested_by: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  resolved_at: string | null;
}

export type Side = "A" | "B";

export function sideOf(game: GameRow, userId: string): Side | null {
  if (game.player_a === userId) return "A";
  if (game.player_b === userId) return "B";
  return null;
}

export function userOf(game: GameRow, side: Side): string {
  return side === "A" ? game.player_a : game.player_b;
}

export function opponentOf(game: GameRow, userId: string): string {
  return game.player_a === userId ? game.player_b : game.player_a;
}
