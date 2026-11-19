# Tournament FMS implementation

- Build the three supplied screens as a connected tournament workspace: team setup/draw, group fixtures/standings, and knockout bracket.
- Persist tournament name, roster, groups, results, and bracket in local storage; provide sample data, paste-list import, new/reset controls, and printable bracket export.
- Implement round-robin fixtures, seeded/random/manual group draws, editable scores, points and goal-difference tables with head-to-head tie-breaks, penalty shootouts, and recalculating knockout advancement.
- Use a distinctive, restrained editorial sports-management visual style while preserving the wireframes' hierarchy and familiar labels.
- Validate key scoring and progression rules with unit tests, then exercise the complete flow and inspect desktop/tablet/phone layouts.

## Technical details
- Keep tournament rules in a pure TypeScript module and screen state in React with localStorage persistence.
- Use the existing shadcn controls and add only semantic theme tokens.
