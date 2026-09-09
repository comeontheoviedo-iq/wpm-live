import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { playingColorsForMatch } from "@/lib/kit-colors";
import { ObsPitchUnderlayClient } from "./pitch-client";

export const dynamic = "force-dynamic";

export default async function ObsPitchUnderlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const { homeColor, awayColor } = playingColorsForMatch(match);

  const overrideByPlayer = new Map(
    match.playerOverrides.map((o) => [o.playerId, o])
  );

  const slim = (
    p: {
      id: string;
      name: string;
      shirtNumber: number | null;
      formationSlot: string | null;
      isStarter: boolean;
      onPitch: boolean;
    }
  ) => {
    const o = overrideByPlayer.get(p.id);
    return {
      id: p.id,
      name: o?.displayName || p.name,
      shirtNumber: o?.jerseyNumber ?? p.shirtNumber ?? 0,
      formationSlot: o?.formationSlot ?? p.formationSlot,
      isStarter: p.isStarter,
      onPitch: p.onPitch,
      pitchX: o?.pitchX ?? null,
      pitchY: o?.pitchY ?? null,
    };
  };

  return (
    <ObsPitchUnderlayClient
      matchId={match.id}
      homeName={match.homeClub.shortName}
      awayName={match.awayClub.shortName}
      homeColor={homeColor}
      awayColor={awayColor}
      homeFormation={match.homeFormation || "4-2-3-1"}
      awayFormation={match.awayFormation || "4-2-3-1"}
      homePlayers={match.homeClub.players
        .filter((p) => p.isStarter || p.onPitch)
        .map(slim)}
      awayPlayers={match.awayClub.players
        .filter((p) => p.isStarter || p.onPitch)
        .map(slim)}
    />
  );
}
