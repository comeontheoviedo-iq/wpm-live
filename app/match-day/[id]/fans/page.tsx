import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default async function FansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const homeFans = match.homeClub.fansApprox || 0;
  const awayFans = match.awayClub.fansApprox || 0;
  const expected = Math.round(
    (match.venue?.capacity || 10000) * 0.78
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Fans</h2>
        <p className="text-sm text-slate-500">Crowd & support context</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">Expected attendance</div>
            <div className="text-3xl font-bold mt-1">
              ~{expected.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Cap {match.venue?.capacity.toLocaleString() || "—"}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">
              {match.homeClub.shortName} membership
            </div>
            <div className="text-3xl font-bold mt-1">
              {homeFans.toLocaleString()}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">
              {match.awayClub.shortName} travelling (est.)
            </div>
            <div className="text-3xl font-bold mt-1">~800</div>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" /> Atmosphere cues
          </CardTitle>
        </CardHeader>
        <CardBody className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
          <p>
            Home ultras occupy the South Stand — expect continuous support after
            the 10th minute. Away fans are allocated the North End; strong
            travelling following from Whitby tonight.
          </p>
          <p>
            Nickname callouts: <strong>{match.homeClub.nickname}</strong> vs{" "}
            <strong>{match.awayClub.nickname}</strong>. Total club fanbases{" "}
            {(homeFans + awayFans).toLocaleString()} combined.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
