export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export type DrawMode = "potted" | "random" | "manual";
export type TournamentStage = "setup" | "groups" | "knockout";
export type Team = { id: string; name: string; pot: number; manualGroup: string | null };
export type TournamentMatch = {
  id: string;
  round: string;
  group: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  status: "scheduled" | "live" | "full-time";
};
export type TournamentState = {
  name: string;
  stage: TournamentStage;
  drawMode: DrawMode;
  teams: Team[];
  groups: Record<string, string[]>;
  groupMatches: TournamentMatch[];
  knockoutMatches: TournamentMatch[];
};
export type Standing = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export const SAMPLE_TEAMS = [
  "Apex FC", "Northstar United", "Harbor Athletic", "Kingsbridge FC",
  "Thunder SC", "Redwood Rovers", "Metro City", "Cobalt Town",
  "Summit Wanderers", "Rivergate FC", "Eastfield Athletic", "Olympic Vale",
  "Westport United", "Ironclad FC", "Lakeside City", "Union Park",
];

export function emptyTournament(): TournamentState {
  return { name: "Tournament", stage: "setup", drawMode: "potted", teams: [], groups: {}, groupMatches: [], knockoutMatches: [] };
}

export function makeTeam(name: string, index: number): Team {
  return { id: `team-${index}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), pot: (index % 4) + 1, manualGroup: null };
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function match(id: string, round: string, group: string | null, homeTeamId: string | null, awayTeamId: string | null): TournamentMatch {
  return { id, round, group, homeTeamId, awayTeamId, homeScore: null, awayScore: null, homePens: null, awayPens: null, status: "scheduled" };
}

export function makeRoundRobinMatches(groups: Record<string, string[]>): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  Object.entries(groups).forEach(([group, teamIds]) => {
    const rotation = [...teamIds];
    const rounds = rotation.length - 1;
    for (let round = 0; round < rounds; round += 1) {
      for (let index = 0; index < rotation.length / 2; index += 1) {
        let home = rotation[index];
        let away = rotation[rotation.length - 1 - index];
        if (round % 2 === 1 && index === 0) [home, away] = [away, home];
        matches.push(match(`group-${group}-${round + 1}-${index + 1}`, `Round ${round + 1}`, group, home, away));
      }
      const fixed = rotation[0];
      const rest = rotation.slice(1);
      rest.unshift(rest.pop() as string);
      rotation.splice(0, rotation.length, fixed, ...rest);
    }
  });
  return matches;
}

export function buildGroups(teams: Team[], mode: DrawMode): Record<string, string[]> {
  const groupCount = teams.length / 4;
  const labels = GROUPS.slice(0, groupCount);
  const result: Record<string, string[]> = Object.fromEntries(labels.map((label) => [label, []]));
  if (mode === "manual") {
    teams.forEach((team) => {
      if (team.manualGroup && result[team.manualGroup]) result[team.manualGroup].push(team.id);
    });
    teams.filter((team) => !labels.some((label) => result[label].includes(team.id))).forEach((team) => {
      const next = labels.find((label) => result[label].length < 4);
      if (next) result[next].push(team.id);
    });
    return result;
  }
  if (mode === "random") {
    shuffled(teams).forEach((team, index) => result[labels[index % labels.length]].push(team.id));
    return result;
  }
  for (let pot = 1; pot <= 4; pot += 1) {
    shuffled(teams.filter((team) => team.pot === pot)).forEach((team, index) => result[labels[index % labels.length]].push(team.id));
  }
  return result;
}

export function calculateStandings(group: string, state: TournamentState): Standing[] {
  const rows = new Map<string, Standing>();
  (state.groups[group] ?? []).forEach((teamId) => rows.set(teamId, {
    teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
  }));
  state.groupMatches.filter((game) => game.group === group && game.status === "full-time" && game.homeScore !== null && game.awayScore !== null).forEach((game) => {
    const home = game.homeTeamId ? rows.get(game.homeTeamId) : undefined;
    const away = game.awayTeamId ? rows.get(game.awayTeamId) : undefined;
    if (!home || !away || game.homeScore === null || game.awayScore === null) return;
    home.played += 1;
    away.played += 1;
    home.goalsFor += game.homeScore;
    home.goalsAgainst += game.awayScore;
    away.goalsFor += game.awayScore;
    away.goalsAgainst += game.homeScore;
    if (game.homeScore > game.awayScore) { home.won += 1; home.points += 3; away.lost += 1; }
    else if (game.homeScore < game.awayScore) { away.won += 1; away.points += 3; home.lost += 1; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  });
  const list = [...rows.values()];
  list.forEach((row) => { row.goalDifference = row.goalsFor - row.goalsAgainst; });
  const headToHead = new Map<string, { points: number; difference: number; goalsFor: number }>();
  state.groupMatches.filter((game) => game.group === group && game.status === "full-time" && game.homeScore !== null && game.awayScore !== null).forEach((game) => {
    if (!game.homeTeamId || !game.awayTeamId || game.homeScore === null || game.awayScore === null) return;
    const home = headToHead.get(game.homeTeamId) ?? { points: 0, difference: 0, goalsFor: 0 };
    const away = headToHead.get(game.awayTeamId) ?? { points: 0, difference: 0, goalsFor: 0 };
    home.goalsFor += game.homeScore;
    away.goalsFor += game.awayScore;
    home.difference += game.homeScore - game.awayScore;
    away.difference += game.awayScore - game.homeScore;
    if (game.homeScore > game.awayScore) home.points += 3;
    else if (game.homeScore < game.awayScore) away.points += 3;
    else { home.points += 1; away.points += 1; }
    headToHead.set(game.homeTeamId, home);
    headToHead.set(game.awayTeamId, away);
  });
  return list.sort((left, right) => {
    const leftH2h = headToHead.get(left.teamId) ?? { points: 0, difference: 0, goalsFor: 0 };
    const rightH2h = headToHead.get(right.teamId) ?? { points: 0, difference: 0, goalsFor: 0 };
    return right.points - left.points || rightH2h.points - leftH2h.points || rightH2h.difference - leftH2h.difference || rightH2h.goalsFor - leftH2h.goalsFor || right.goalDifference - left.goalDifference || right.goalsFor - left.goalsFor || left.teamId.localeCompare(right.teamId);
  });
}

export function allGroupMatchesComplete(state: TournamentState): boolean {
  return state.groupMatches.length > 0 && state.groupMatches.every((game) => game.status === "full-time" && game.homeScore !== null && game.awayScore !== null);
}

export function groupMatchCount(teamCount: number): number {
  return (teamCount === 8 || teamCount === 16) ? (teamCount / 4) * 6 : 0;
}

export function createKnockoutMatches(state: TournamentState): TournamentMatch[] {
  const qualified = Object.keys(state.groups).flatMap((group) => calculateStandings(group, state).slice(0, 2).map((row, index) => ({ group, rank: index + 1, teamId: row.teamId })));
  const count = qualified.length;
  if (count < 4) return [];
  const quarterPairs: [number, number][] = count >= 8
    ? [[0, 7], [2, 5], [4, 3], [6, 1]]
    : [[0, 3], [2, 1]];
  const quarterRound = count >= 8 ? "Quarter-finals" : "Semi-finals";
  const matches = quarterPairs.map(([home, away], index) => match(`ko-qf-${index + 1}`, quarterRound, null, qualified[home]?.teamId ?? null, qualified[away]?.teamId ?? null));
  if (count < 8) {
    return [
      match("ko-sf-1", "Semi-finals", null, qualified[0]?.teamId ?? null, qualified[3]?.teamId ?? null),
      match("ko-sf-2", "Semi-finals", null, qualified[2]?.teamId ?? null, qualified[1]?.teamId ?? null),
      match("ko-third", "3rd place", null, null, null),
      match("ko-final", "Grand Final", null, null, null),
    ];
  }
  matches.push(match("ko-sf-1", "Semi-finals", null, null, null), match("ko-sf-2", "Semi-finals", null, null, null), match("ko-third", "3rd place", null, null, null), match("ko-final", "Grand Final", null, null, null));
  return matches;
}

export function matchWinner(game: TournamentMatch): string | null {
  if (game.status !== "full-time" || game.homeScore === null || game.awayScore === null || !game.homeTeamId || !game.awayTeamId) return null;
  if (game.homeScore !== game.awayScore) return game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
  if (game.homePens === null || game.awayPens === null || game.homePens === game.awayPens) return null;
  return game.homePens > game.awayPens ? game.homeTeamId : game.awayTeamId;
}

function losingTeam(game: TournamentMatch): string | null {
  const winner = matchWinner(game);
  if (!winner) return null;
  return winner === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
}

export function saveGroupScore(state: TournamentState, matchId: string, homeScore: number, awayScore: number): TournamentState {
  return { ...state, groupMatches: state.groupMatches.map((game) => game.id === matchId ? { ...game, homeScore, awayScore, status: "full-time", homePens: null, awayPens: null } : game) };
}

export function saveKnockoutScore(state: TournamentState, matchId: string, scores: { homeScore: number; awayScore: number; homePens?: number | null; awayPens?: number | null }): TournamentState {
  const updated = state.knockoutMatches.map((game) => game.id === matchId ? { ...game, ...scores, status: "full-time" as const } : game);
  const source = updated.find((game) => game.id === matchId);
  if (!source) return state;
  const sourceRound = source.round;
  const reset = (game: TournamentMatch, homeTeamId: string | null, awayTeamId: string | null) => {
    game.homeTeamId = homeTeamId;
    game.awayTeamId = awayTeamId;
    game.homeScore = null;
    game.awayScore = null;
    game.homePens = null;
    game.awayPens = null;
    game.status = "scheduled";
  };
  const quarterGames = updated.filter((game) => game.id.startsWith("ko-qf-"));
  const semiGames = updated.filter((game) => game.id.startsWith("ko-sf-") || (!updated.some((item) => item.id.startsWith("ko-sf-")) && game.id.startsWith("ko-qf-")));
  if (source.id.startsWith("ko-qf-") && updated.some((game) => game.id.startsWith("ko-sf-"))) {
    const semiOne = updated.find((game) => game.id === "ko-sf-1");
    const semiTwo = updated.find((game) => game.id === "ko-sf-2");
    resetIfMatch(semiOne, matchWinner(quarterGames[0]), matchWinner(quarterGames[1]), reset);
    resetIfMatch(semiTwo, matchWinner(quarterGames[2]), matchWinner(quarterGames[3]), reset);
    const final = updated.find((game) => game.id === "ko-final");
    const third = updated.find((game) => game.id === "ko-third");
    resetIfMatch(final, null, null, reset);
    resetIfMatch(third, null, null, reset);
  }
  if (sourceRound === "Semi-finals") {
    const finalists = semiGames.length === 2 ? semiGames : semiGames.slice(0, 2);
    const final = updated.find((game) => game.id === "ko-final");
    const third = updated.find((game) => game.id === "ko-third");
    if (final) reset(final, matchWinner(finalists[0]), matchWinner(finalists[1]));
    if (third) reset(third, losingTeam(finalists[0]), losingTeam(finalists[1]));
  }
  return { ...state, knockoutMatches: updated };
}

function resetIfMatch(
  game: TournamentMatch | undefined,
  homeTeamId: string | null,
  awayTeamId: string | null,
  reset: (game: TournamentMatch, homeTeamId: string | null, awayTeamId: string | null) => void,
) {
  if (game) reset(game, homeTeamId, awayTeamId);
}

export function teamById(state: TournamentState, teamId: string | null): Team | undefined {
  return teamId ? state.teams.find((team) => team.id === teamId) : undefined;
}
