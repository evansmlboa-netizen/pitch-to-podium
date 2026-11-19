# Remix of Tournament Director

An FMS (Fixture Management System) that generates a knockout tournament with group stages and the knockout stage, featuring visual brackets and representations, that enables entering teams, automatically generating fixtures, recording match results, and advancing teams appropriately through the tournament tree.

Locked:
- Core tournament flows from the mockups:
  1. Team Roster & Draw Setup: Input teams (manual entry, paste list, or quick sample autofill), pot seeding (Pots 1-4), group configuration (e.g. 16 teams into 4 groups of 4, top 2 advance), draw generation engine (seeded draw, random shuffle, or manual placement), and round-robin fixture generation.
  2. Group Stage & Live Standings: Group fixture schedule with inline score inputs (home/away scores, match status FT/live), automatic calculation of standings tables (Played, Won, Drawn, Lost, Goals For, Goals Against, Goal Difference, Points, head-to-head tiebreakers), and qualification badges highlighting advancing teams.
  3. Interactive Visual Knockout Bracket: Multi-round tree visualization (Quarter-Finals, Semi-Finals, 3rd Place Match, Grand Final) with dynamic connector lines, direct score entry on match cards, penalty shootout handling for knockout draws, auto-advancement of winners to next rounds, and champion celebration banner with trophy.
- Device: responsive desktop-first layout for clear side-by-side tables and expansive bracket canvas, smoothly responsive on tablet and mobile.

Open:
- Styling: Modern, polished sports management aesthetic with crisp typography, card containers, bracket connection paths, status badges, and team crests.
- State & Persistence: Local persistence (localStorage) so tournament data, rosters, match results, and bracket progression persist across reloads, with options to create new tournaments, reset matches, or load presets.
- Match controls & overrides: Ability to edit previously entered scores (with automatic cascade recalculation of standings and bracket seeds), penalty shootouts when matches end in a tie, and bracket export (image/print view).

build a real working app, not a clickable prototype; the screen and kit files show layout, content and look (a wireframe's, structure only) and are never code to copy. The screens are the moments the user designed, not the whole product. Before building, walk through each flow as its user would and design what the pictures leave out, as a product designer would for this product: the steps a flow needs to finish and how the app responds to what the user does, including the moments its users will actually run into, like waiting on something or finding nothing yet. Add nothing a user of this product would never meet, and keep an app the user wants simple, simple. Never leave a step the product's core flows need as "coming soon", unless the brief says the user chose to. Where such a step needs an outside service, build every part up to it and say in your reply what's left to connect. Fill product gaps only, never a look the design set: an added step reuses the UI kit's tokens, chrome and parts and the nearest designed screen's layout, with no new visual direction. Look at every screen's picture before writing code; design.md says which picture or sheet holds each screen. Open the UI kit's shells and parts HTML for the header, tab bar, composer and components, not only its tokens. Use each finished screen's copy exactly as design.md lists it; never invent copy for one. A wireframe under design.md's Wireframes gives structure only: build it in the design's look, as design.md says. The screens' photos are placeholders for the mockups only: replace every photo design.md lists with the user's own upload for it, else as design.md says (a photo without people re-composed with imagegen--edit_image from it as a reference, a photo of people generated from its brief and never from the photo), and ship no set photo or its URL. For a design that came with no design.md, every photo on assets.lovable.dev or images.unsplash.com is a set photo: replace it with the user's own upload for it, else a new image generated for its slot, any person in it one who doesn't exist, never from the photo or a picture showing it. Build and check each screen at the canvas it was drawn at: phone 393×764, tablet landscape 1133×744, tablet portrait 744×1133, desktop 1280×832. After building, screenshot the app at those sizes and states, compare each finished screen with its picture, and fix every visual difference you didn't choose; check a wireframe's screen against its structure, never its grey look. End your reply with "Changed from the mockups": each deliberate change and why, and "Added beyond the mockups": each step, state or interaction you built that no screen shows.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2e4912d4-ca30-476e-ae3e-93892a64fdad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
