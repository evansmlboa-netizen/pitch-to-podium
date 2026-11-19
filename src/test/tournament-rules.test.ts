import { describe, expect, it } from "vitest";

import {
  allGroupMatchesComplete,
  buildGroups,
  calculateStandings,
  createKnockoutMatches,
  emptyTournament,
  groupMatchCount,
  makeRoundRobinMatches,
  makeTeam,
  matchWinner,
  saveGroupScore,
  saveKnockoutScore,
  type TournamentMatch,
  type TournamentState,
} from "@/lib/tournament";

function idOf(state: TournamentState, name: string): string {
  const team = state.teams.find((entry) => entry.name === name);
  if (!team) throw new Error(`unknown club ${name}`);
  return team.id;
}

function stateWithGroups(groups: Record<string, string[]>): TournamentState {
  const names = Object.values(groups).flat();
  const teams = names.map((name, index) => makeTeam(name, index));
  const byName = new Map(teams.map((team) => [team.name, team.id]));
  const resolved: Record<string, string[]> = {};
  Object.entries(groups).forEach(([label, members]) => {
    resolved[label] = members.map((name) => byName.get(name) as string);
  });
  return {
    ...emptyTournament(),
    name: "Rules test",
    teams,
    groups: resolved,
    groupMatches: makeRoundRobinMatches(resolved),
  };
}

function withResults(
  state: TournamentState,
  results: [string, string, number, number][],
): TournamentState {
  return results.reduce((current, [home, away, homeScore, awayScore]) => {
    const homeId = idOf(state, home);
    const awayId = idOf(state, away);
    const fixture =
      current.groupMatches.find((game) => game.homeTeamId === homeId && game.awayTeamId === awayId) ??
      current.groupMatches.find((game) => game.homeTeamId === awayId && game.awayTeamId === homeId);
    if (!fixture) throw new Error(`no fixture for ${home} v ${away}`);
    const reversed = fixture.homeTeamId === awayId;
    return saveGroupScore(
      current,
      fixture.id,
      reversed ? awayScore : homeScore,
      reversed ? homeScore : awayScore,
    );
  }, state);
}

function completeGroupStage(state: TournamentState): TournamentState {
  return {
    ...state,
    groupMatches: state.groupMatches.map((game) => ({
      ...game,
      homeScore: 2,
      awayScore: 0,
      status: "full-time" as const,
    })),
  };
}

function knockoutFixture(state: TournamentState, id: string): TournamentMatch {
  const game = state.knockoutMatches.find((entry) => entry.id === id);
  if (!game) throw new Error(`missing knockout fixture ${id}`);
  return game;
}

describe("group stage scoring", () => {
  it("awards 3 points for a win, 1 for a draw and 0 for a loss", () => {
    const state = stateWithGroups({ A: ["Alpha", "Beta", "Gamma", "Delta"] });
    const scored = withResults(state, [
      ["Alpha", "Beta", 2, 0],
      ["Gamma", "Delta", 1, 1],
      ["Alpha", "Gamma", 0, 0],
      ["Beta", "Delta", 0, 0],
      ["Alpha", "Delta", 0, 0],
      ["Beta", "Gamma", 0, 0],
    ]);
    const table = calculateStandings("A", scored);
    const points = new Map(table.map((row) => [row.teamId, row.points]));
    expect(points.get(idOf(scored, "Alpha"))).toBe(5);
    expect(points.get(idOf(scored, "Gamma"))).toBe(3);
    expect(points.get(idOf(scored, "Delta"))).toBe(3);
    expect(points.get(idOf(scored, "Beta"))).toBe(2);
  });

  it("breaks a points tie on goal difference", () => {
    const state = stateWithGroups({ A: ["Alpha", "Beta", "Gamma", "Delta"] });
    const scored = withResults(state, [
      ["Alpha", "Beta", 1, 0],
      ["Alpha", "Gamma", 1, 0],
      ["Delta", "Alpha", 5, 0],
      ["Beta", "Gamma", 1, 0],
      ["Beta", "Delta", 1, 0],
      ["Gamma", "Delta", 1, 0],
    ]);
    const table = calculateStandings("A", scored);
    const alpha = table.find((row) => row.teamId === idOf(scored, "Alpha"));
    const beta = table.find((row) => row.teamId === idOf(scored, "Beta"));
    expect(alpha?.points).toBe(6);
    expect(beta?.points).toBe(6);
    expect(alpha?.goalDifference).toBe(-3);
    expect(beta?.goalDifference).toBe(1);
    expect(table.indexOf(beta!)).toBeLessThan(table.indexOf(alpha!));
  });

  it("counts each pair of clubs exactly once in a four-club group", () => {
    const state = stateWithGroups({ A: ["Alpha", "Beta", "Gamma", "Delta"] });
    const pairs = state.groupMatches.map((game) =>
      [game.homeTeamId, game.awayTeamId].sort().join("|"),
    );
    expect(state.groupMatches).toHaveLength(6);
    expect(new Set(pairs).size).toBe(6);
  });

  it("marks a group complete only when every fixture has a score", () => {
    const state = stateWithGroups({ A: ["Alpha", "Beta", "Gamma", "Delta"] });
    expect(allGroupMatchesComplete(state)).toBe(false);
    const scored = withResults(state, [["Alpha", "Beta", 1, 0]]);
    expect(allGroupMatchesComplete(scored)).toBe(false);
    expect(allGroupMatchesComplete(completeGroupStage(state))).toBe(true);
  });

  it("keeps a group score free of penalty columns", () => {
    const state = stateWithGroups({ A: ["Alpha", "Beta", "Gamma", "Delta"] });
    const fixture = state.groupMatches[0];
    const scored = saveGroupScore(state, fixture.id, 3, 1);
    const saved = scored.groupMatches.find((game) => game.id === fixture.id);
    expect(saved?.status).toBe("full-time");
    expect(saved?.homePens).toBeNull();
    expect(saved?.awayPens).toBeNull();
  });

  it("sizes the schedule at 12 fixtures for 8 clubs and 24 for 16", () => {
    expect(groupMatchCount(8)).toBe(12);
    expect(groupMatchCount(16)).toBe(24);
    expect(groupMatchCount(12)).toBe(0);
  });
});

describe("knockout winner rules", () => {
  const base: TournamentMatch = {
    id: "ko-x",
    round: "Grand Final",
    group: null,
    homeTeamId: "h",
    awayTeamId: "a",
    homeScore: null,
    awayScore: null,
    homePens: null,
    awayPens: null,
    status: "scheduled",
  };

  it("picks the higher scorer without penalties", () => {
    expect(matchWinner({ ...base, homeScore: 2, awayScore: 1, status: "full-time" })).toBe("h");
    expect(matchWinner({ ...base, homeScore: 0, awayScore: 3, status: "full-time" })).toBe("a");
  });

  it("decides a draw on penalties and waits when they are missing or level", () => {
    expect(matchWinner({ ...base, homeScore: 1, awayScore: 1, homePens: 4, awayPens: 3, status: "full-time" })).toBe("h");
    expect(matchWinner({ ...base, homeScore: 1, awayScore: 1, homePens: 2, awayPens: 5, status: "full-time" })).toBe("a");
    expect(matchWinner({ ...base, homeScore: 1, awayScore: 1, status: "full-time" })).toBeNull();
    expect(matchWinner({ ...base, homeScore: 1, awayScore: 1, homePens: 4, awayPens: 4, status: "full-time" })).toBeNull();
  });

  it("has no winner before full time", () => {
    expect(matchWinner({ ...base, homeScore: 5, awayScore: 0, status: "live" })).toBeNull();
  });
});

describe("draw generation", () => {
  it("places one club from every pot in each group", () => {
    const teams = Array.from({ length: 16 }, (_, index) => makeTeam(`Club ${index + 1}`, index));
    const groups = buildGroups(teams, "potted");
    const labels = Object.keys(groups);
    expect(labels).toEqual(["A", "B", "C", "D"]);
    labels.forEach((label) => {
      const pots = groups[label].map((teamId) => teams.find((team) => team.id === teamId)?.pot);
      expect([...pots].sort()).toEqual([1, 2, 3, 4]);
    });
  });

  it("fills every group with four clubs and uses each club once", () => {
    const teams = Array.from({ length: 16 }, (_, index) => makeTeam(`Club ${index + 1}`, index));
    const groups = buildGroups(teams, "random");
    const placed = Object.values(groups).flat();
    expect(placed).toHaveLength(16);
    expect(new Set(placed).size).toBe(16);
    Object.values(groups).forEach((members) => expect(members).toHaveLength(4));
  });

  it("honours manual group choices", () => {
    const teams = Array.from({ length: 8 }, (_, index) => ({
      ...makeTeam(`Club ${index + 1}`, index),
      manualGroup: index < 4 ? "A" : "B",
    }));
    const groups = buildGroups(teams, "manual");
    expect(groups.A).toHaveLength(4);
    expect(groups.B).toHaveLength(4);
    expect(groups.A).toContain(teams[0].id);
    expect(groups.B).toContain(teams[7].id);
  });
});

describe("knockout seeding and advancement", () => {
  it("seeds eight clubs into four quarter-finals, two semi-finals, third place and a final", () => {
    const state = completeGroupStage(
      stateWithGroups({
        A: ["A1", "A2", "A3", "A4"],
        B: ["B1", "B2", "B3", "B4"],
        C: ["C1", "C2", "C3", "C4"],
        D: ["D1", "D2", "D3", "D4"],
      }),
    );
    const bracket = createKnockoutMatches(state);
    expect(bracket).toHaveLength(8);
    expect(bracket.filter((game) => game.round === "Quarter-finals")).toHaveLength(4);
    expect(bracket.filter((game) => game.round === "Semi-finals")).toHaveLength(2);
    expect(bracket.filter((game) => game.round === "3rd place")).toHaveLength(1);
    expect(bracket.filter((game) => game.round === "Grand Final")).toHaveLength(1);
    const seeded = bracket.filter((game) => game.round === "Quarter-finals").flatMap((game) => [game.homeTeamId, game.awayTeamId]);
    expect(seeded.filter(Boolean)).toHaveLength(8);
    expect(new Set(seeded).size).toBe(8);
    expect(bracket.filter((game) => game.id === "ko-final")[0].homeTeamId).toBeNull();
  });

  it("seeds four clubs straight into semi-finals", () => {
    const state = completeGroupStage(
      stateWithGroups({ A: ["A1", "A2", "A3", "A4"], B: ["B1", "B2", "B3", "B4"] }),
    );
    const bracket = createKnockoutMatches(state);
    expect(bracket.map((game) => game.id)).toEqual(["ko-sf-1", "ko-sf-2", "ko-third", "ko-final"]);
    const seeded = bracket.filter((game) => game.round === "Semi-finals").flatMap((game) => [game.homeTeamId, game.awayTeamId]);
    expect(seeded.filter(Boolean)).toHaveLength(4);
    expect(new Set(seeded).size).toBe(4);
  });

  it("refuses to build a bracket from fewer than four qualifiers", () => {
    const state = completeGroupStage(stateWithGroups({ A: ["A1", "A2", "A3", "A4"] }));
    expect(createKnockoutMatches(state)).toEqual([]);
  });

  it("sends quarter-final winners into the semi-finals", () => {
    let state = completeGroupStage(
      stateWithGroups({
        A: ["A1", "A2", "A3", "A4"],
        B: ["B1", "B2", "B3", "B4"],
        C: ["C1", "C2", "C3", "C4"],
        D: ["D1", "D2", "D3", "D4"],
      }),
    );
    state = { ...state, knockoutMatches: createKnockoutMatches(state) };
    const first = knockoutFixture(state, "ko-qf-1");
    const second = knockoutFixture(state, "ko-qf-2");
    state = saveKnockoutScore(state, "ko-qf-1", { homeScore: 2, awayScore: 0 });
    state = saveKnockoutScore(state, "ko-qf-2", { homeScore: 0, awayScore: 1 });
    const semi = knockoutFixture(state, "ko-sf-1");
    expect(semi.homeTeamId).toBe(first.homeTeamId);
    expect(semi.awayTeamId).toBe(second.awayTeamId);
    expect(knockoutFixture(state, "ko-final").homeTeamId).toBeNull();
  });

  it("sends semi-final winners to the final and losers to third place", () => {
    let state = completeGroupStage(
      stateWithGroups({ A: ["A1", "A2", "A3", "A4"], B: ["B1", "B2", "B3", "B4"] }),
    );
    state = { ...state, knockoutMatches: createKnockoutMatches(state) };
    const semiOne = knockoutFixture(state, "ko-sf-1");
    const semiTwo = knockoutFixture(state, "ko-sf-2");
    state = saveKnockoutScore(state, "ko-sf-1", { homeScore: 1, awayScore: 0 });
    state = saveKnockoutScore(state, "ko-sf-2", { homeScore: 2, awayScore: 2, homePens: 5, awayPens: 4 });
    const final = knockoutFixture(state, "ko-final");
    const third = knockoutFixture(state, "ko-third");
    expect(final.homeTeamId).toBe(semiOne.homeTeamId);
    expect(final.awayTeamId).toBe(semiTwo.homeTeamId);
    expect(third.homeTeamId).toBe(semiOne.awayTeamId);
    expect(third.awayTeamId).toBe(semiTwo.awayTeamId);
  });

  it("clears a final slot when a semi-final result is rewritten", () => {
    let state = completeGroupStage(
      stateWithGroups({ A: ["A1", "A2", "A3", "A4"], B: ["B1", "B2", "B3", "B4"] }),
    );
    state = { ...state, knockoutMatches: createKnockoutMatches(state) };
    const semiOne = knockoutFixture(state, "ko-sf-1");
    state = saveKnockoutScore(state, "ko-sf-1", { homeScore: 1, awayScore: 0 });
    state = saveKnockoutScore(state, "ko-sf-1", { homeScore: 0, awayScore: 3 });
    const final = knockoutFixture(state, "ko-final");
    expect(final.homeTeamId).toBe(semiOne.awayTeamId);
    expect(final.homeScore).toBeNull();
    expect(final.status).toBe("scheduled");
  });
});
