import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { ScriptsClient } from "@/components/scripts/scripts-client";

export default async function ScriptsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <ScriptsClient
      matchId={match.id}
      homeShort={match.homeClub.shortName}
      awayShort={match.awayClub.shortName}
      initialSpeaks={match.speaks.map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body,
        timing: s.timing,
        order: s.order,
        status: s.status,
      }))}
    />
  );
}
