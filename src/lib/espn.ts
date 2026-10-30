import type { Match, Team, TeamForm } from './types';

const ESPN_SEARCH = 'https://site.api.espn.com/apis/common/v3/search';
const ESPN_TEAM = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams';
const REQUEST_TIMEOUT_MS = 15_000;
const FORM_SIZE = 8;

/** Exhibition and pre-season invitational tournaments are not competitive fixtures. */
const NON_COMPETITIVE = /friendly|emirates cup|audi cup|international champions cup|florida cup|joan gamper/i;

const LEAGUE_LABELS: Record<string, string> = {
  'eng.1': 'Premier League',
  'eng.2': 'Championship',
  'eng.3': 'League One',
  'eng.4': 'League Two',
  'eng.5': 'National League',
  'eng.fa': 'FA Cup',
  'eng.fa_qual': 'FA Cup Qualifying',
  'eng.league_cup': 'EFL Cup',
  'eng.trophy': 'EFL Trophy',
  'eng.charity': 'Community Shield',
  'esp.1': 'LaLiga',
  'esp.2': 'Segunda División',
  'esp.3': 'Primera Federación',
  'esp.copa_del_rey': 'Copa del Rey',
  'ger.1': 'Bundesliga',
  'ger.2': '2. Bundesliga',
  'ger.3': '3. Liga',
  'ger.dfb_pokal': 'DFB-Pokal',
  'ita.1': 'Serie A',
  'ita.2': 'Serie B',
  'ita.3': 'Serie C',
  'ita.coppa_italia': 'Coppa Italia',
  'fra.1': 'Ligue 1',
  'fra.2': 'Ligue 2',
  'fra.3': 'Championnat National',
  'fra.coupe_de_france': 'Coupe de France',
  'ned.1': 'Eredivisie',
  'ned.2': 'Eerste Divisie',
  'por.1': 'Primeira Liga',
  'por.2': 'Liga Portugal 2',
  'bel.1': 'Belgian Pro League',
  'sco.1': 'Scottish Premiership',
  'sco.2': 'Scottish Championship',
  'tur.1': 'Süper Lig',
  'gre.1': 'Super League Greece',
  'rus.1': 'Russian Premier League',
  'bra.1': 'Brasileirão Série A',
  'bra.2': 'Brasileirão Série B',
  'bra.3': 'Brasileirão Série C',
  'arg.1': 'Liga Profesional',
  'arg.2': 'Primera Nacional',
  'arg.3': 'Primera B',
  'gha.1': 'Ghana Premier League',
  'rsa.1': 'South African Premiership',
  'egy.1': 'Egyptian Premier League',
  'mar.1': 'Botola Pro',
  'nga.1': 'Nigeria Premier League',
  'kor.1': 'K League 1',
  'aus.1': 'A-League',
  'chn.1': 'Chinese Super League',
  'ind.1': 'Indian Super League',
  'usa.2': 'USL Championship',
  'mex.2': 'Liga de Expansión',
  'ksa.2': 'Saudi First Division',
  'jpn.2': 'J2 League',
  'usa.1': 'Major League Soccer',
  'mex.1': 'Liga MX',
  'ksa.1': 'Saudi Pro League',
  'jpn.1': 'J1 League',
  'uefa.champions': 'UEFA Champions League',
  'uefa.europa': 'UEFA Europa League',
  'uefa.europa.conf': 'UEFA Conference League',
  'uefa.nations': 'UEFA Nations League',
  'uefa.conf_qual': 'Conference League Qualifying',
  'uefa.euro': 'UEFA Euro',
  'uefa.euroq': 'Euro Qualifying',
  'fifa.world': 'International',
  'fifa.confederations': 'Confederations Cup',
  'fifa.olympics': 'Olympics',
  'conmebol.libertadores': 'Copa Libertadores',
  'conmebol.sudamericana': 'Copa Sudamericana',
  'caf.champions': 'CAF Champions League',
  'afc.champions': 'AFC Champions League',
  'concacaf.champions': 'CONCACAF Champions Cup',
  'club.friendly': 'Club Friendly',
  'fifa.worldq.uefa': 'World Cup Qualifying',
  'fifa.worldq.conmebol': 'World Cup Qualifying',
  'conmebol.america': 'Copa América',
  'caf.afcon': 'Africa Cup of Nations',
  'afc.asian': 'AFC Asian Cup',
};

interface EspnLogo {
  href?: string;
  rel?: string[];
}

interface EspnSearchItem {
  id?: string;
  uid?: string;
  displayName?: string;
  type?: string;
  sport?: string;
  league?: string;
  color?: string;
  logos?: EspnLogo[];
}

interface EspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  team?: { id?: string; displayName?: string; logos?: EspnLogo[] };
  score?: { value?: number; displayValue?: string; shootoutScore?: number };
}

interface EspnEvent {
  id?: string;
  date?: string;
  season?: { displayName?: string };
  competitions?: Array<{
    status?: { type?: { completed?: boolean; name?: string } };
    neutralSite?: boolean;
    competitors?: EspnCompetitor[];
  }>;
}

interface EspnSchedule {
  events?: EspnEvent[];
}

export function leagueLabel(slug: string | undefined): string {
  if (!slug) return 'Football';
  if (LEAGUE_LABELS[slug]) return LEAGUE_LABELS[slug];
  const tail = slug.split('.').pop() ?? slug;
  if (/^\d+$/.test(tail)) return 'Domestic league';
  return tail.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function logoOf(logos: EspnLogo[] | undefined): string | undefined {
  if (!logos?.length) return undefined;
  const preferred = logos.find((l) => l.rel?.includes('default')) ?? logos[0];
  return preferred?.href;
}

/** Hide women's, youth and reserve sides so club names stay unambiguous. */
function isSeniorSide(item: EspnSearchItem): boolean {
  const league = item.league ?? '';
  const name = item.displayName ?? '';
  if (/\.w\./.test(league)) return false;
  if (/\b(U-?\d{2}|U19|U20|U21|U23)\b/i.test(name)) return false;
  if (/\s(II|B|Castilla|Reserves|Academy)$/i.test(name)) return false;
  return true;
}

function relevance(name: string, query: string): number {
  const lower = name.toLowerCase();
  const q = query.trim().toLowerCase();
  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  if (lower.split(/\s+/).some((word) => word === q)) return 2;
  return 3;
}

const searchCache = new Map<string, Team[]>();

export async function searchTeams(query: string): Promise<Team[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const response = await fetch(
    `${ESPN_SEARCH}?query=${encodeURIComponent(q)}&limit=25`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error(`Team search failed (${response.status})`);

  const data = (await response.json()) as { items?: EspnSearchItem[] };
  const seen = new Set<string>();
  const teams: Team[] = [];

  for (const item of data.items ?? []) {
    if (item.type !== 'team' || item.sport !== 'soccer') continue;
    if (!item.id || !item.displayName || !isSeniorSide(item)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    teams.push({
      id: item.id,
      name: item.displayName,
      league: item.league ?? '',
      leagueLabel: leagueLabel(item.league),
      logo: logoOf(item.logos),
      color: item.color,
    });
  }

  teams.sort((a, b) => relevance(a.name, q) - relevance(b.name, q));
  const result = teams.slice(0, 12);
  searchCache.set(key, result);
  return result;
}

function seasonStartYear(now = new Date()): number {
  // European seasons start in July/August; use the previous year from January to June.
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function scoreValue(score: EspnCompetitor['score']): number | null {
  if (!score) return null;
  const raw = typeof score.value === 'number' ? score.value : Number(score.displayValue);
  return Number.isFinite(raw) ? raw : null;
}

function shortCompetition(seasonName: string | undefined): string {
  const cleaned = (seasonName ?? '').replace(/^\d{4}(?:-\d{2})?\s+/, '').trim();
  return cleaned || 'Competition';
}

function parseEvent(event: EspnEvent, teamId: string): Match | null {
  const competition = event.competitions?.[0];
  if (!competition?.status?.type?.completed) return null;
  if (!event.id || !event.date) return null;

  const competitors = competition.competitors ?? [];
  const me = competitors.find((c) => String(c.team?.id) === teamId);
  const opponent = competitors.find((c) => String(c.team?.id) !== teamId);
  if (!me || !opponent || !me.team?.id || !opponent.team?.id) return null;

  const goalsFor = scoreValue(me.score);
  const goalsAgainst = scoreValue(opponent.score);
  if (goalsFor === null || goalsAgainst === null) return null;

  const competitionName = shortCompetition(event.season?.displayName);
  if (NON_COMPETITIVE.test(competitionName)) return null;

  const shootout =
    typeof me.score?.shootoutScore === 'number' && typeof opponent.score?.shootoutScore === 'number'
      ? { for: me.score.shootoutScore, against: opponent.score.shootoutScore }
      : undefined;

  return {
    eventId: event.id,
    date: event.date,
    competition: competitionName,
    opponent: opponent.team.displayName ?? 'Opponent',
    opponentLogo: logoOf(opponent.team.logos),
    isHome: me.homeAway === 'home',
    neutral: Boolean(competition.neutralSite),
    goalsFor,
    goalsAgainst,
    outcome: goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
    shootout,
    weight: 1,
    venuePreferred: false,
  };
}

const seasonCache = new Map<string, Promise<Match[]>>();

async function fetchSeason(teamId: string, season: number): Promise<Match[]> {
  const key = `${teamId}:${season}`;
  const cached = seasonCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    const response = await fetch(`${ESPN_TEAM}/${teamId}/schedule?season=${season}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
    const data = (await response.json()) as EspnSchedule;
    const matches: Match[] = [];
    for (const event of data.events ?? []) {
      const match = parseEvent(event, teamId);
      if (match) matches.push(match);
    }
    return matches;
  })();

  seasonCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    seasonCache.delete(key);
    throw error;
  }
}

export async function fetchTeamForm(team: Team, venue: 'home' | 'away'): Promise<TeamForm> {
  const base = seasonStartYear();
  const seasons = [base, base - 1, base - 2];

  const settled = await Promise.allSettled(seasons.map((season) => fetchSeason(team.id, season)));
  if (settled.every((entry) => entry.status === 'rejected')) {
    throw new Error(`Could not load matches for ${team.name}. Please try again.`);
  }

  const byId = new Map<string, Match>();
  for (const entry of settled) {
    if (entry.status !== 'fulfilled') continue;
    for (const match of entry.value) {
      if (!byId.has(match.eventId)) byId.set(match.eventId, match);
    }
  }

  const all = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
  if (all.length === 0) {
    throw new Error(`ESPN has no completed matches on record for ${team.name}.`);
  }

  // Prefer true home form for the home side and true away form for the away side.
  // Neutral-venue fixtures (cup finals, tournaments) are not home or away form.
  const preferredVenue = venue === 'home';
  const preferred = all.filter((match) => !match.neutral && match.isHome === preferredVenue);
  const selected: Match[] = preferred.slice(0, FORM_SIZE);
  const usedIds = new Set(selected.map((match) => match.eventId));

  if (selected.length < FORM_SIZE) {
    for (const match of all) {
      if (selected.length >= FORM_SIZE) break;
      if (usedIds.has(match.eventId)) continue;
      selected.push(match);
      usedIds.add(match.eventId);
    }
  }

  selected.sort((a, b) => b.date.localeCompare(a.date));
  const matches = selected.map((match, index) => ({
    ...match,
    weight: index < 4 ? 1.5 : 1,
    venuePreferred: !match.neutral && match.isHome === preferredVenue,
  }));

  return {
    team,
    venue,
    matches,
    venueMatchCount: matches.filter((match) => match.venuePreferred).length,
    filledMatchCount: matches.filter((match) => !match.venuePreferred).length,
    fetchedAt: new Date().toISOString(),
  };
}
