export interface Team {
  id: string;
  name: string;
  league: string;
  leagueLabel: string;
  logo?: string;
  color?: string;
}

export interface Shootout {
  for: number;
  against: number;
}

export interface Match {
  eventId: string;
  date: string;
  competition: string;
  opponent: string;
  opponentLogo?: string;
  isHome: boolean;
  neutral: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: 'W' | 'D' | 'L';
  shootout?: Shootout;
  /** Recency weight: 1.5 for the four most recent matches, 1.0 for the next four. */
  weight: number;
  /** True when the match was played at the preferred venue (home or away). */
  venuePreferred: boolean;
}

export interface TeamForm {
  team: Team;
  venue: 'home' | 'away';
  /** Up to eight matches, newest first. */
  matches: Match[];
  venueMatchCount: number;
  filledMatchCount: number;
  fetchedAt: string;
}
