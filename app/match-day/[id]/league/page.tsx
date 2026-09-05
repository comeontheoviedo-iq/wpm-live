import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { LeagueIntel } from "@/components/match/league-intel";

export default async function MatchLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4">
      <LeagueIntel matchId={match.id} />
    </div>
  );
}
