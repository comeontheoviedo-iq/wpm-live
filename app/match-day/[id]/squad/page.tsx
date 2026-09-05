import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { SquadPageClient } from "@/components/match/squad-page-client";

export default async function SquadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const mapPlayers = (
    players: typeof match.homeClub.players,
    side: "home" | "away",
    team: string
  ) =>
    players.map((p) => ({
      id: p.id,
      name: p.name,
      shirtNumber: p.shirtNumber,
      position: p.position,
      nationality: p.nationality,
      isStarter: p.isStarter,
      onPitch: p.onPitch,
      formationSlot: p.formationSlot,
      side,
      team,
    }));

  return (
    <SquadPageClient
      matchId={match.id}
      homeName={match.homeClub.shortName}
      awayName={match.awayClub.shortName}
      homeColor={match.homeClub.primaryColor}
      awayColor={match.awayClub.primaryColor}
      status={match.status}
      homePlayers={mapPlayers(
        match.homeClub.players,
        "home",
        match.homeClub.shortName
      )}
      awayPlayers={mapPlayers(
        match.awayClub.players,
        "away",
        match.awayClub.shortName
      )}
    />
  );
}
