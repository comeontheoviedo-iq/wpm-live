import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { NewsPanel } from "@/components/match/news-panel";

export default async function MatchNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-0 py-2">
      <NewsPanel
        matchId={match.id}
        homeName={match.homeClub.shortName || match.homeClub.name}
        awayName={match.awayClub.shortName || match.awayClub.name}
        competition={match.matchDay?.competition || undefined}
        homeClubId={match.homeClub.id}
        awayClubId={match.awayClub.id}
      />
    </div>
  );
}
