import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronRight,
  CircleHelp,
  CopyPlus,
  Crown,
  Download,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GROUPS,
  SAMPLE_TEAMS,
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
  teamById,
  type DrawMode,
  type Standing,
  type Team,
  type TournamentMatch,
  type TournamentStage,
  type TournamentState,
} from "@/lib/tournament";
import { cn } from "@/lib/utils";

type SavedTournament = { id: string; state: TournamentState };
type ActiveScreen = TournamentStage;
type ScoreDraft = { home: string; away: string; homePens: string; awayPens: string };
const STORAGE_KEY = "bracketry-tournaments-v1";
const DEFAULT_TOURNAMENT_ID = "tournament-default";

const navigation: { id: ActiveScreen; label: string; number: string }[] = [
  { id: "setup", label: "Team Setup & Draw", number: "01" },
  { id: "groups", label: "Group Fixtures & Scoring", number: "02" },
  { id: "knockout", label: "Knockout Bracket", number: "03" },
];

function parsePersisted(value: string | null): { activeId: string; tournaments: SavedTournament[] } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { activeId?: string; tournaments?: SavedTournament[] };
    if (!Array.isArray(parsed.tournaments) || parsed.tournaments.length === 0) return null;
    const valid = parsed.tournaments.filter((entry) => entry && typeof entry.id === "string" && entry.state && Array.isArray(entry.state.teams));
    if (!valid.length) return null;
    return { activeId: valid.some((entry) => entry.id === parsed.activeId) ? parsed.activeId ?? valid[0].id : valid[0].id, tournaments: valid };
  } catch {
    return null;
  }
}

function countCompleted(state: TournamentState) {
  return state.groupMatches.filter((game) => game.status === "full-time").length;
}

function draftFor(game: TournamentMatch): ScoreDraft {
  return {
    home: game.homeScore === null ? "" : String(game.homeScore),
    away: game.awayScore === null ? "" : String(game.awayScore),
    homePens: game.homePens === null ? "" : String(game.homePens),
    awayPens: game.awayPens === null ? "" : String(game.awayPens),
  };
}

function tournamentId() {
  return `tournament-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function teamInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function TeamCrest({ team, small = false }: { team?: Team; small?: boolean }) {
  return (
    <span className={cn("team-crest", small && "team-crest-small", !team && "team-crest-empty")} aria-hidden="true">
      {team ? teamInitials(team.name) : <Shield size={small ? 12 : 15} strokeWidth={1.7} />}
    </span>
  );
}

function StageRibbon({ stage, setStage, complete }: { stage: ActiveScreen; setStage: (value: ActiveScreen) => void; complete: boolean }) {
  return (
    <nav aria-label="Tournament stages" className="stage-ribbon">
      {navigation.map((item, index) => {
        const locked = (item.id === "groups" && !complete) || (item.id === "knockout" && stage !== "knockout" && !complete);
        return (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="ghost"
            aria-current={stage === item.id ? "step" : undefined}
            className={cn("stage-link", stage === item.id && "stage-link-current")}
            onClick={() => setStage(item.id)}
            disabled={locked}
          >
            <span className="stage-link-number">{item.number}</span>
            <span className="truncate">{item.label}</span>
            {index < navigation.length - 1 && <ChevronRight aria-hidden="true" className="stage-chevron" />}
          </Button>
        );
      })}
    </nav>
  );
}

function SectionHeading({ eyebrow, title, trailing }: { eyebrow?: string; title: string; trailing?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

function TeamRow({
  team,
  index,
  manual,
  groupLabels,
  onChange,
  onRemove,
}: {
  team: Team;
  index: number;
  manual: boolean;
  groupLabels: string[];
  onChange: (patch: Partial<Team>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="roster-row">
      <span className="roster-index">{String(index + 1).padStart(2, "0")}</span>
      <TeamCrest team={team} small />
      <Input aria-label={`Team ${index + 1} name`} value={team.name} onChange={(event) => onChange({ name: event.target.value })} className="roster-name" />
      <Select value={String(team.pot)} onValueChange={(value) => onChange({ pot: Number(value) })}>
        <SelectTrigger aria-label={`${team.name || `Team ${index + 1}`} pot`} className="roster-select"><SelectValue /></SelectTrigger>
        <SelectContent>{[1, 2, 3, 4].map((pot) => <SelectItem key={pot} value={String(pot)}>Pot {pot}</SelectItem>)}</SelectContent>
      </Select>
      {manual && (
        <Select value={team.manualGroup ?? "auto"} onValueChange={(value) => onChange({ manualGroup: value === "auto" ? null : value })}>
          <SelectTrigger aria-label={`${team.name || `Team ${index + 1}`} group`} className="roster-select roster-group-select"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="auto">Auto</SelectItem>{groupLabels.map((group) => <SelectItem key={group} value={group}>Group {group}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Button variant="ghost" size="icon" aria-label={`Remove ${team.name || `team ${index + 1}`}`} className="row-remove" onClick={onRemove}><X /></Button>
    </div>
  );
}

function SetupScreen({ state, update, onGenerate, onSample }: { state: TournamentState; update: (next: TournamentState) => void; onGenerate: () => void; onSample: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const groupLabels = GROUPS.slice(0, state.teams.length / 4 || 4);
  const validCount = state.teams.length === 8 || state.teams.length === 16;
  const duplicateName = state.teams.some((team, index) => team.name.trim().toLowerCase() && state.teams.findIndex((other) => other.name.trim().toLowerCase() === team.name.trim().toLowerCase()) !== index);

  const addTeam = (name: string) => {
    const clean = name.trim();
    if (!clean || state.teams.length >= 16 || state.teams.some((team) => team.name.trim().toLowerCase() === clean.toLowerCase())) return false;
    update({ ...state, teams: [...state.teams, makeTeam(clean, state.teams.length)], groups: {}, groupMatches: [], knockoutMatches: [], stage: "setup" });
    return true;
  };

  const addPastedTeams = () => {
    const names = pasted.split(/[\n,\t;]+/).map((name) => name.trim()).filter(Boolean);
    const currentNames = new Set(state.teams.map((team) => team.name.trim().toLowerCase()));
    const unique = [...new Set(names)].filter((name) => !currentNames.has(name.toLowerCase()));
    const capacity = Math.max(0, 16 - state.teams.length);
    const accepted = unique.slice(0, capacity);
    if (!accepted.length) return;
    update({ ...state, teams: [...state.teams, ...accepted.map((name, index) => makeTeam(name, state.teams.length + index))], groups: {}, groupMatches: [], knockoutMatches: [], stage: "setup" });
    setPasted("");
    setShowPaste(false);
  };

  const loadSample = () => {
    update({ ...emptyTournament(), name: state.name, teams: SAMPLE_TEAMS.map((name, index) => makeTeam(name, index)) });
  };

  return (
    <main className="workspace-main setup-main">
      <section className="format-band">
        <div className="format-copy"><p className="eyebrow">Format</p><h2>Group Stage <span>+</span> Knockout</h2><p>4 teams per group · top 2 qualify</p></div>
        <div className="format-stats"><div><strong>08 / 16</strong><span>clubs</span></div><div><strong>04</strong><span>pots</span></div><div><strong>02</strong><span>qualify</span></div></div>
      </section>

      <div className="setup-columns">
        <section className="surface-panel roster-panel">
          <SectionHeading eyebrow="01 / FIELD OF PLAY" title="Team roster" trailing={<Badge variant="outline" className="count-badge">{state.teams.length} / 16 clubs</Badge>} />
          <div className="roster-tools">
            <form className="add-team-form" onSubmit={(event) => { event.preventDefault(); if (addTeam(teamName)) setTeamName(""); }}>
              <Input aria-label="Team name" placeholder="Enter a club name" value={teamName} maxLength={40} onChange={(event) => setTeamName(event.target.value)} disabled={state.teams.length >= 16} />
              <Button type="submit" size="sm" disabled={!teamName.trim() || state.teams.length >= 16}><Plus /> Add team</Button>
            </form>
            <div className="roster-shortcuts">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPaste((value) => !value)}><CopyPlus /> Paste list</Button>
              <Button type="button" variant="outline" size="sm" onClick={loadSample}><Sparkles /> Quick sample autofill</Button>
            </div>
          </div>
          {showPaste && (
            <div className="paste-panel">
              <label htmlFor="team-paste">Paste one name per line, or separate names with commas</label>
              <textarea id="team-paste" value={pasted} onChange={(event) => setPasted(event.target.value)} rows={4} placeholder="Northstar United&#10;Harbor Athletic&#10;Kingsbridge FC" />
              <div className="paste-actions"><span>{Math.min(pasted.split(/[\n,\t;]+/).filter((name) => name.trim()).length, 16 - state.teams.length)} names available</span><Button type="button" size="sm" onClick={addPastedTeams} disabled={!pasted.trim() || state.teams.length >= 16}>Add names</Button></div>
            </div>
          )}
          {state.teams.length === 0 ? (
            <div className="empty-roster"><div className="empty-mark"><Shield /></div><strong>Start with your clubs</strong><p>Add teams individually, paste a list, or load a sample roster to see the draw.</p><Button type="button" variant="outline" size="sm" onClick={loadSample}><Sparkles /> Load 16-team sample</Button></div>
          ) : (
            <div className="roster-list" role="list" aria-label="Team roster">
              {state.teams.map((team, index) => (
                <TeamRow key={team.id} team={team} index={index} manual={state.drawMode === "manual"} groupLabels={groupLabels} onChange={(patch) => update({ ...state, teams: state.teams.map((item) => item.id === team.id ? { ...item, ...patch } : item), groups: {}, groupMatches: [], knockoutMatches: [], stage: "setup" })} onRemove={() => update({ ...state, teams: state.teams.filter((item) => item.id !== team.id), groups: {}, groupMatches: [], knockoutMatches: [], stage: "setup" })} />
              ))}
            </div>
          )}
          {duplicateName && <p className="validation-note" role="alert">Each club needs a unique name.</p>}
        </section>

        <section className="surface-panel draw-panel">
          <SectionHeading eyebrow="02 / TOURNAMENT DESIGN" title="Draw engine" />
          <div className="draw-mode-list" role="radiogroup" aria-label="Draw engine">
            {([
              ["potted", "Potted draw", "One club from each pot in every group"],
              ["random", "Random shuffle", "A fresh shuffle across all groups"],
              ["manual", "Manual placement", "Choose a group for each club"],
            ] as [DrawMode, string, string][]).map(([mode, title, detail]) => (
              <button key={mode} type="button" role="radio" aria-checked={state.drawMode === mode} className={cn("draw-mode", state.drawMode === mode && "draw-mode-selected")} onClick={() => update({ ...state, drawMode: mode })}>
                <span className="radio-dot" /><span className="draw-mode-copy"><strong>{title}</strong><small>{detail}</small></span>{state.drawMode === mode && <span className="mode-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="draw-note"><CircleHelp size={15} /><p>{state.drawMode === "manual" ? "Choose group placements in the roster. Unassigned clubs fill the remaining spaces in order." : state.drawMode === "potted" ? "Each group receives one team from Pots 1–4." : "All clubs are shuffled before groups are filled."}</p></div>
          <div className="schedule-setting"><div><p className="eyebrow">Schedule</p><strong>Single round-robin</strong><span>Every club plays each group opponent once</span></div><Badge variant="secondary">{groupMatchCount(state.teams.length) || "—"} matches</Badge></div>
          <Button type="button" className="generate-button" onClick={onGenerate} disabled={!validCount || duplicateName || state.teams.some((team) => !team.name.trim())}>
            <Sparkles /> Generate Groups &amp; Fixture Schedule <ArrowDownToLine />
          </Button>
          {!validCount && <p className="validation-note">Add 8 or 16 clubs to create a balanced group draw.</p>}
        </section>
      </div>

      <section className="group-preview" aria-label="Group preview">
        {(Object.keys(state.groups).length ? Object.keys(state.groups) : GROUPS.slice(0, validCount ? state.teams.length / 4 : 4)).map((group) => {
          const teamIds = state.groups[group] ?? [];
          return <div className="group-preview-card" key={group}><div className="group-preview-heading"><span className="group-letter">{group}</span><div><p>Group {group}</p><span>{teamIds.length || 4} clubs · 2 advance</span></div></div><div className="group-preview-list">{teamIds.length ? teamIds.map((id, index) => { const team = teamById(state, id); return <div className="preview-team" key={id}><span className={cn("qualify-dot", index < 2 && "qualify-dot-on")} /><TeamCrest team={team} small /><span>{team?.name ?? "Awaiting draw"}</span></div>; }) : <p className="preview-empty">Awaiting draw</p>}</div></div>;
        })}
      </section>
    </main>
  );
}

function StandingsTable({ group, state }: { group: string; state: TournamentState }) {
  const standings = calculateStandings(group, state);
  const teams = state.teams;
  return (
    <section className="surface-panel standings-panel">
      <div className="standings-heading"><span className="group-letter">{group}</span><div><h3>Group {group}</h3><span>{standings.length} clubs · top 2 qualify</span></div><Badge variant="outline" className="table-progress">{standings.filter((row) => row.played > 0).length ? `${standings.reduce((total, row) => total + row.played, 0) / 2}/6` : "0/6"}</Badge></div>
      <div className="table-scroll"><table className="standings-table"><thead><tr><th>#</th><th>Team</th><th title="Played">P</th><th title="Goal difference">GD</th><th title="Points">Pts</th></tr></thead><tbody>
        {standings.map((row, index) => {
          const team = teams.find((entry) => entry.id === row.teamId);
          return <tr key={row.teamId} className={index < 2 ? "qualifying-row" : undefined}><td><span className={cn("table-position", index < 2 && "position-qualified")}>{index + 1}</span></td><td><div className="table-team"><TeamCrest team={team} small /><span>{team?.name ?? "Club"}</span></div></td><td>{row.played}</td><td className={row.goalDifference > 0 ? "positive-gd" : undefined}>{row.goalDifference > 0 ? "+" : ""}{row.goalDifference}</td><td className="points-cell">{row.points}</td></tr>;
        })}
        {standings.length === 0 && <tr><td colSpan={5} className="empty-table-row">Generate groups to seed the standings.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function FixtureCard({ game, state, update }: { game: TournamentMatch; state: TournamentState; update: (next: TournamentState) => void }) {
  const home = teamById(state, game.homeTeamId);
  const away = teamById(state, game.awayTeamId);
  const [draft, setDraft] = useState(() => draftFor(game));
  useEffect(() => setDraft(draftFor(game)), [game.homeScore, game.awayScore, game.status]);
  const homeScore = Number(draft.home);
  const awayScore = Number(draft.away);
  const hasResult = game.status === "full-time" && game.homeScore !== null;
  const homeWins = hasResult && game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore;
  const awayWins = hasResult && game.homeScore !== null && game.awayScore !== null && game.awayScore > game.homeScore;
  const save = () => {
    if (draft.home === "" || draft.away === "" || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) return;
    update(saveGroupScore(state, game.id, homeScore, awayScore));
  };
  return (
    <article className={cn("fixture-card", hasResult && "fixture-card-complete")}>
      <div className="fixture-meta"><span>Matchday {game.round.replace("Round ", "")}</span><Badge variant={hasResult ? "secondary" : "outline"} className={cn("status-badge", hasResult && "status-complete")}>{hasResult ? "Full Time" : "Scheduled"}</Badge></div>
      <div className="fixture-scoreline">
        <div className={cn("fixture-team", "fixture-team-home", homeWins && "fixture-winner")}><TeamCrest team={home} small /><span>{home?.name ?? "TBD"}</span></div>
        <Input aria-label={`${home?.name ?? "Home"} score`} className="score-input" type="number" min="0" max="99" inputMode="numeric" value={draft.home} onChange={(event) => setDraft({ ...draft, home: event.target.value })} />
        <span className="score-dash">–</span>
        <Input aria-label={`${away?.name ?? "Away"} score`} className="score-input" type="number" min="0" max="99" inputMode="numeric" value={draft.away} onChange={(event) => setDraft({ ...draft, away: event.target.value })} />
        <div className={cn("fixture-team", "fixture-team-away", awayWins && "fixture-winner")}><span>{away?.name ?? "TBD"}</span><TeamCrest team={away} small /></div>
      </div>
      <div className="fixture-footer"><span className="fixture-round">{game.round}</span><Button size="sm" variant={hasResult ? "outline" : "default"} onClick={save} disabled={draft.home === "" || draft.away === ""}>{hasResult ? "Save Score" : "Save Score"}</Button></div>
    </article>
  );
}

function GroupsScreen({ state, update, onLock }: { state: TournamentState; update: (next: TournamentState) => void; onLock: () => void }) {
  const groupNames = Object.keys(state.groups);
  const [filter, setFilter] = useState("All");
  const [round, setRound] = useState("Round 1");
  const complete = allGroupMatchesComplete(state);
  const groupsRemaining = state.groupMatches.length - countCompleted(state);
  const visibleGames = state.groupMatches.filter((game) => (filter === "All" || game.group === filter) && game.round === round);
  const totalRounds = Math.max(1, state.teams.length / 4 - 1);
  const rounds = Array.from({ length: totalRounds }, (_, index) => `Round ${index + 1}`);

  return (
    <main className="workspace-main group-main">
      <div className="group-topline"><div><p className="eyebrow">Group stage · {complete ? "Complete" : `${groupsRemaining} matches remaining`}</p><h1>Group Fixtures &amp; Scoring</h1><p className="group-subtitle">Group Phase · Round {round.replace("Round ", "")} of {totalRounds}</p></div>
        <div className="fixture-completion"><strong>{countCompleted(state)}<span>/{state.groupMatches.length}</span></strong><span>Group matches</span><div className="completion-track"><span style={{ width: `${state.groupMatches.length ? countCompleted(state) / state.groupMatches.length * 100 : 0}%` }} /></div></div>
      </div>
      <div className="group-filter-bar">
        <div className="filter-tabs" role="group" aria-label="Filter standings by group">
          {["All", ...groupNames].map((group) => <Button key={group} type="button" size="sm" variant={filter === group ? "default" : "outline"} className="filter-pill" onClick={() => setFilter(group)}>{group}</Button>)}
        </div>
        <Select value={round} onValueChange={setRound}><SelectTrigger aria-label="Matchday" className="matchday-select"><SelectValue /></SelectTrigger><SelectContent>{rounds.map((item) => <SelectItem key={item} value={item}>Matchday {item.replace("Round ", "")}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="group-content-grid">
        <div className="standings-grid">{groupNames.filter((group) => filter === "All" || filter === group).map((group) => <StandingsTable key={group} group={group} state={state} />)}</div>
        <section className="fixtures-column">
          <div className="fixtures-column-heading"><div><p className="eyebrow">{filter === "All" ? "ALL GROUPS" : `GROUP ${filter}`}</p><h2>Matchday {round.replace("Round ", "")}</h2></div><Badge variant="outline">{visibleGames.length} fixtures</Badge></div>
          <div className="fixture-list">{visibleGames.length ? visibleGames.map((game) => <FixtureCard key={game.id} game={game} state={state} update={update} />) : <div className="empty-fixtures"><Trophy /><strong>No fixtures on this matchday</strong><span>Choose a group and matchday to see the schedule.</span></div>}</div>
        </section>
      </div>
      {complete && <div className="complete-callout"><div className="complete-callout-copy"><span className="complete-mark">✓</span><div><strong>Group stage complete: {groupNames.length * 2} teams qualified</strong><span>Standings are ready to seed the knockout bracket.</span></div></div><Button onClick={onLock}>Lock Standings &amp; Seed Knockout Bracket <ChevronRight /></Button></div>}
    </main>
  );
}

function TeamSlot({ team, score, winner, onClick }: { team?: Team; score: number | null; winner: boolean; onClick?: () => void }) {
  return <div className={cn("bracket-team-slot", winner && "bracket-team-winner")} onClick={onClick}><TeamCrest team={team} small /><span className="bracket-team-name">{team?.name ?? "To be decided"}</span><strong className="bracket-score">{score ?? "–"}</strong>{winner && <span className="winner-marker" aria-label="Winner"><Crown size={12} /></span>}</div>;
}

function KnockoutMatchCard({ game, state, selected, onSelect }: { game: TournamentMatch; state: TournamentState; selected: boolean; onSelect: () => void }) {
  const home = teamById(state, game.homeTeamId);
  const away = teamById(state, game.awayTeamId);
  const winner = matchWinner(game);
  return (
    <button type="button" className={cn("bracket-match", selected && "bracket-match-selected")} aria-label={`${game.round}: ${home?.name ?? "TBD"} against ${away?.name ?? "TBD"}`} aria-pressed={selected} onClick={onSelect}>
      <span className="match-card-topline"><span>{game.round}</span><span className={cn("match-live-indicator", game.status === "full-time" && "match-done")}>{game.status === "full-time" ? "FT" : "UP NEXT"}</span></span>
      <TeamSlot team={home} score={game.homeScore} winner={winner === home?.id} />
      <TeamSlot team={away} score={game.awayScore} winner={winner === away?.id} />
      {game.homeScore === game.awayScore && game.homeScore !== null && <span className="penalty-summary">Pens {game.homePens ?? "–"} : {game.awayPens ?? "–"}</span>}
    </button>
  );
}

function MatchEditPanel({ game, state, onSave }: { game: TournamentMatch; state: TournamentState; onSave: (scores: { homeScore: number; awayScore: number; homePens?: number | null; awayPens?: number | null }) => void }) {
  const [draft, setDraft] = useState(() => draftFor(game));
  useEffect(() => setDraft(draftFor(game)), [game.id, game.homeScore, game.awayScore, game.homePens, game.awayPens]);
  const home = teamById(state, game.homeTeamId);
  const away = teamById(state, game.awayTeamId);
  const homeScore = Number(draft.home);
  const awayScore = Number(draft.away);
  const tied = draft.home !== "" && draft.away !== "" && homeScore === awayScore;
  const validScores = draft.home !== "" && draft.away !== "" && Number.isInteger(homeScore) && Number.isInteger(awayScore) && homeScore >= 0 && awayScore >= 0;
  const validPens = !tied || (draft.homePens !== "" && draft.awayPens !== "" && Number.isInteger(Number(draft.homePens)) && Number.isInteger(Number(draft.awayPens)) && Number(draft.homePens) !== Number(draft.awayPens));
  const ready = Boolean(home && away && validScores && validPens);
  return (
    <div className="match-editor">
      <div className="editor-title"><div><p className="eyebrow">SELECTED MATCH</p><strong>{game.round}</strong></div><Badge variant="outline">{game.status === "full-time" ? "Edit result" : "Score Entry"}</Badge></div>
      <div className="editor-score-grid">
        <label><span><TeamCrest team={home} small />{home?.name ?? "TBD"}</span><Input aria-label={`${home?.name ?? "Home"} score`} type="number" min="0" max="99" inputMode="numeric" value={draft.home} onChange={(event) => setDraft({ ...draft, home: event.target.value })} /></label>
        <span className="editor-dash">–</span>
        <label><span><TeamCrest team={away} small />{away?.name ?? "TBD"}</span><Input aria-label={`${away?.name ?? "Away"} score`} type="number" min="0" max="99" inputMode="numeric" value={draft.away} onChange={(event) => setDraft({ ...draft, away: event.target.value })} /></label>
      </div>
      {tied && <div className="penalty-entry"><div><p className="eyebrow">PENALTY SHOOTOUT</p><span>Choose a winner to advance</span></div><Input aria-label={`${home?.name ?? "Home"} penalty score`} type="number" min="0" inputMode="numeric" value={draft.homePens} onChange={(event) => setDraft({ ...draft, homePens: event.target.value })} /><span>:</span><Input aria-label={`${away?.name ?? "Away"} penalty score`} type="number" min="0" inputMode="numeric" value={draft.awayPens} onChange={(event) => setDraft({ ...draft, awayPens: event.target.value })} /></div>}
      <div className="editor-actions"><span>{ready ? (tied ? "Winner decided on penalties" : "Winner advances automatically") : !home || !away ? "Waiting for qualified clubs" : "Enter a score to continue"}</span><Button onClick={() => onSave({ homeScore, awayScore, homePens: tied ? Number(draft.homePens) : null, awayPens: tied ? Number(draft.awayPens) : null })} disabled={!ready}>Confirm Winner &amp; Advance <ChevronRight /></Button></div>
    </div>
  );
}

function BracketColumn({ title, children, side }: { title: string; children: React.ReactNode; side?: "left" | "right" }) {
  return <div className={cn("bracket-column", side && `bracket-column-${side}`)}><p className="bracket-column-title">{title}</p><div className="bracket-column-matches">{children}</div></div>;
}

function KnockoutScreen({ state, update, onReset }: { state: TournamentState; update: (next: TournamentState) => void; onReset: () => void }) {
  const games = state.knockoutMatches;
  const [selectedId, setSelectedId] = useState(() => games.find((game) => game.id === "ko-final")?.id ?? games[0]?.id ?? "");
  const [zoom, setZoom] = useState(1);
  const selected = games.find((game) => game.id === selectedId) ?? games.find((game) => game.id === "ko-final") ?? games[0];
  const qfs = games.filter((game) => game.id.startsWith("ko-qf-"));
  const semis = games.filter((game) => game.id.startsWith("ko-sf-") || (qfs.length === 2 && game.round === "Semi-finals" && game.id.startsWith("ko-qf-") === false));
  const semiMatches = qfs.length === 2 ? qfs : semis;
  const final = games.find((game) => game.id === "ko-final");
  const third = games.find((game) => game.id === "ko-third");
  const championId = final ? matchWinner(final) : null;
  const champion = teamById(state, championId);
  const save = (scores: { homeScore: number; awayScore: number; homePens?: number | null; awayPens?: number | null }) => {
    if (!selected) return;
    update(saveKnockoutScore(state, selected.id, scores));
  };

  return (
    <main className="workspace-main bracket-main">
      <div className="bracket-header"><div><p className="eyebrow">TOURNAMENT TREE · {state.teams.length} CLUBS</p><h1>Knockout Bracket</h1></div><div className="bracket-actions"><div className="zoom-controls" aria-label="Bracket zoom controls"><Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.85, value - 0.1))}>−</Button><span>{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.15, value + 0.1))}>+</Button><Button variant="ghost" size="icon" aria-label="Reset zoom" onClick={() => setZoom(1)}><RotateCcw /></Button></div><Button type="button" variant="outline" size="sm" onClick={() => window.print()}><Download /> Export / Print</Button><Button type="button" variant="ghost" size="sm" onClick={onReset}><RotateCcw /> Reset matches</Button></div></div>
      {champion && <section className="champion-banner"><div className="champion-trophy"><Trophy /></div><div><p className="eyebrow">TOURNAMENT CHAMPION</p><h2>{champion.name}</h2><span>Champions are made one match at a time.</span></div><Crown className="champion-crown" /></section>}

      <section className="bracket-board" aria-label="Tournament knockout tree">
        <div className="bracket-stage-headings"><span>Quarter-finals</span><span>Semi-finals</span><span>Grand Final</span><span>Semi-finals</span><span>Quarter-finals</span></div>
        <div className="bracket-tree" style={{ "--bracket-scale": zoom } as React.CSSProperties}>
          <BracketColumn title="Quarter-finals" side="left">{qfs.slice(0, 2).map((game) => <KnockoutMatchCard key={game.id} game={game} state={state} selected={game.id === selected?.id} onSelect={() => setSelectedId(game.id)} />)}</BracketColumn>
          <span className="bracket-connector connector-left-one" aria-hidden="true" />
          <BracketColumn title="Semi-finals" side="left">{semiMatches[0] && <KnockoutMatchCard game={semiMatches[0]} state={state} selected={semiMatches[0].id === selected?.id} onSelect={() => setSelectedId(semiMatches[0].id)} />}</BracketColumn>
          <span className="bracket-connector connector-left-two" aria-hidden="true" />
          <BracketColumn title="Grand Final" side="center">
            {final && <button type="button" className={cn("grand-final-card", selected?.id === final.id && "grand-final-selected")} onClick={() => setSelectedId(final.id)}><div className="grand-final-art"><Trophy /></div><div className="grand-final-title"><p>Grand Final</p><span>{final.status === "full-time" ? "FULL TIME" : "FINAL"}</span></div><TeamSlot team={teamById(state, final.homeTeamId)} score={final.homeScore} winner={matchWinner(final) === final.homeTeamId} /><TeamSlot team={teamById(state, final.awayTeamId)} score={final.awayScore} winner={matchWinner(final) === final.awayTeamId} />{champion && <div className="winner-banner"><Crown /> Champion <strong>{champion.name}</strong></div>}</button>}
            {third && <div className="third-place-card"><div className="third-place-heading"><span>03</span><strong>3rd Place</strong>{third.status === "full-time" && <Badge variant="secondary">Full Time</Badge>}</div><TeamSlot team={teamById(state, third.homeTeamId)} score={third.homeScore} winner={matchWinner(third) === third.homeTeamId} /><TeamSlot team={teamById(state, third.awayTeamId)} score={third.awayScore} winner={matchWinner(third) === third.awayTeamId} /><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedId(third.id)}>{selected?.id === third.id ? "Selected match" : "Enter result"}</Button></div>}
          </BracketColumn>
          <span className="bracket-connector connector-right-two" aria-hidden="true" />
          <BracketColumn title="Semi-finals" side="right">{semiMatches[1] && <KnockoutMatchCard game={semiMatches[1]} state={state} selected={semiMatches[1].id === selected?.id} onSelect={() => setSelectedId(semiMatches[1].id)} />}</BracketColumn>
          <span className="bracket-connector connector-right-one" aria-hidden="true" />
          <BracketColumn title="Quarter-finals" side="right">{qfs.slice(2, 4).map((game) => <KnockoutMatchCard key={game.id} game={game} state={state} selected={game.id === selected?.id} onSelect={() => setSelectedId(game.id)} />)}</BracketColumn>
        </div>
      </section>
      {selected && <MatchEditPanel key={selected.id} game={selected} state={state} onSave={save} />}
    </main>
  );
}

export function TournamentWorkspace() {
  const [stateReady, setStateReady] = useState(false);
  const [tournaments, setTournaments] = useState<SavedTournament[]>([{ id: DEFAULT_TOURNAMENT_ID, state: emptyTournament() }]);
  const [activeId, setActiveId] = useState(DEFAULT_TOURNAMENT_ID);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("setup");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [toast, setToast] = useState("");
  const current = tournaments.find((entry) => entry.id === activeId) ?? tournaments[0];
  const state = current?.state ?? emptyTournament();
  const complete = allGroupMatchesComplete(state);
  const completionCount = useMemo(() => countCompleted(state), [state]);

  useEffect(() => {
    const persisted = parsePersisted(window.localStorage.getItem(STORAGE_KEY));
    if (persisted) {
      setTournaments(persisted.tournaments);
      setActiveId(persisted.activeId);
      const currentState = persisted.tournaments.find((entry) => entry.id === persisted.activeId)?.state;
      setActiveScreen(currentState?.stage === "groups" || currentState?.stage === "knockout" ? currentState.stage : "setup");
    }
    setStateReady(true);
  }, []);

  useEffect(() => {
    if (!stateReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, tournaments }));
  }, [activeId, stateReady, tournaments]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const update = (next: TournamentState) => {
    setTournaments((entries) => entries.map((entry) => entry.id === activeId ? { ...entry, state: next } : entry));
  };

  const generate = () => {
    const groups = buildGroups(state.teams, state.drawMode);
    const groupMatches = makeRoundRobinMatches(groups);
    update({ ...state, groups, groupMatches, knockoutMatches: [], stage: "groups" });
    setActiveScreen("groups");
    setToast("Groups and fixtures are ready.");
  };

  const lockStandings = () => {
    const knockoutMatches = createKnockoutMatches(state);
    if (knockoutMatches.length === 0) {
      setToast("Complete all group fixtures before seeding the bracket.");
      return;
    }
    update({ ...state, knockoutMatches, stage: "knockout" });
    setActiveScreen("knockout");
  };

  const createTournament = () => {
    const cleanName = newName.trim() || `Tournament ${tournaments.length + 1}`;
    const next = { id: tournamentId(), state: { ...emptyTournament(), name: cleanName } };
    setTournaments((entries) => [...entries, next]);
    setActiveId(next.id);
    setActiveScreen("setup");
    setNewOpen(false);
    setNewName("");
  };

  const resetMatches = () => {
    update({ ...state, groupMatches: state.groupMatches.map((game) => ({ ...game, homeScore: null, awayScore: null, homePens: null, awayPens: null, status: "scheduled" })), knockoutMatches: [], stage: "groups" });
    setActiveScreen("groups");
    setResetOpen(false);
    setToast("All scores were cleared.");
  };

  const resetKnockout = () => {
    update({ ...state, knockoutMatches: createKnockoutMatches(state), stage: "knockout" });
    setResetOpen(false);
    setToast("Knockout matches were reset.");
  };

  const clearAll = () => {
    update({ ...emptyTournament(), name: state.name });
    setActiveScreen("setup");
    setResetAllOpen(false);
    setToast("Tournament roster and results were cleared.");
  };

  const switchTournament = (id: string) => {
    const next = tournaments.find((entry) => entry.id === id);
    setActiveId(id);
    setActiveScreen(next?.state.stage ?? "setup");
  };

  const completedStages = complete || state.stage === "knockout";
  const shownStage = activeScreen === "setup" && state.stage === "groups" ? "groups" : activeScreen === "setup" && state.stage === "knockout" ? "knockout" : activeScreen;

  if (!stateReady) return <div className="loading-screen" aria-label="Loading tournament"><div className="loading-mark"><Trophy /></div><span>Preparing the tournament desk</span></div>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark"><span className="brand-symbol"><ArrowLeftRight /></span><div><strong>Bracketry</strong><span>TOURNAMENT DESK</span></div></div>
        <div className="header-center"><StageRibbon stage={shownStage} setStage={setActiveScreen} complete={completedStages} /></div>
        <div className="header-actions">
          {tournaments.length > 1 && <Select value={activeId} onValueChange={switchTournament}><SelectTrigger aria-label="Choose tournament" className="tournament-select"><SelectValue /></SelectTrigger><SelectContent>{tournaments.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.state.name}</SelectItem>)}</SelectContent></Select>}
          <Button type="button" variant="outline" size="sm" className="new-tournament-button" onClick={() => setNewOpen(true)}><Plus /> <span>New tournament</span></Button>
          {shownStage === "setup" && state.teams.length > 0 && <Button type="button" variant="ghost" size="icon" aria-label="Clear tournament roster" title="Clear tournament roster" onClick={() => setResetAllOpen(true)}><Trash2 /></Button>}
        </div>
      </header>
      <div className="mobile-stage-nav"><StageRibbon stage={shownStage} setStage={setActiveScreen} complete={completedStages} /></div>
      <div className="tournament-title-strip"><div><p className="eyebrow">SEASON 2026 · {state.teams.length || "NO"} CLUBS</p><h1>{state.name}</h1></div><div className="title-status"><span className={cn("status-light", completedStages && "status-light-ready")} />{state.stage === "setup" ? "Draw setup" : state.stage === "groups" ? `${completionCount} / ${state.groupMatches.length} matches played` : "Knockout stage"}</div></div>
      {shownStage === "setup" && <SetupScreen state={state} update={update} onGenerate={generate} onSample={() => update({ ...emptyTournament(), name: state.name, teams: SAMPLE_TEAMS.map((name, index) => makeTeam(name, index)) })} />}
      {shownStage === "groups" && <GroupsScreen state={state} update={update} onLock={lockStandings} />}
      {shownStage === "knockout" && <KnockoutScreen state={state} update={update} onReset={() => setResetOpen(true)} />}
      <footer className="app-footer"><div><span className="footer-dot" />BRACKETRY <span className="footer-separator">/</span> FIXTURES MADE CLEAR</div><span>LOCAL TOURNAMENT DESK</span></footer>

      <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogHeader><DialogTitle>New tournament</DialogTitle><DialogDescription>Create a separate tournament. Your current roster and results stay saved.</DialogDescription></DialogHeader><label className="dialog-label" htmlFor="new-tournament-name">Tournament name</label><Input id="new-tournament-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Summer Cup 2026" maxLength={50} onKeyDown={(event) => { if (event.key === "Enter") createTournament(); }} /><DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={createTournament}><Plus /> Create tournament</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent><DialogHeader><DialogTitle>Reset match results?</DialogTitle><DialogDescription>All scores and knockout progress will be cleared. Your clubs, draw, and group schedule will stay in place.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setResetOpen(false)}>Keep results</Button><Button variant="destructive" onClick={resetMatches}><RotateCcw /> Reset results</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={resetAllOpen} onOpenChange={setResetAllOpen}><DialogContent><DialogHeader><DialogTitle>Clear this tournament?</DialogTitle><DialogDescription>The club roster, draw, schedule, and results will be removed from this tournament.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setResetAllOpen(false)}>Cancel</Button><Button variant="destructive" onClick={clearAll}><Trash2 /> Clear tournament</Button></DialogFooter></DialogContent></Dialog>
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}