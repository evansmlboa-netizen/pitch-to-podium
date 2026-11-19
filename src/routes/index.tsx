import { createFileRoute } from "@tanstack/react-router";
import { TournamentWorkspace } from "@/components/tournament/tournament-workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bracketry — Tournament Desk" },
      { name: "description", content: "Build group draws, manage fixtures, record scores, and follow every team through a tournament bracket." },
      { property: "og:title", content: "Bracketry — Tournament Desk" },
      { property: "og:description", content: "Tournament setup, group fixtures, live standings, and knockout advancement in one clear workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentWorkspace,
});
