import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Ruler } from "lucide-react";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const v = match.venue;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Venue</h2>
        <p className="text-sm text-slate-500">Ground intel for commentary</p>
      </div>
      {!v ? (
        <p className="text-sm text-slate-500">No venue linked.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4 text-teal-600" />
                {v.name}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="grid sm:grid-cols-2 gap-3">
                <Info label="City" value={v.city} />
                <Info label="Address" value={v.address || "—"} />
                <Info label="Surface" value={v.surface} />
                <Info label="Opened" value={v.opened ? String(v.opened) : "—"} />
              </div>
              {v.notes && (
                <div className="rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900 p-3 text-sm leading-relaxed">
                  {v.notes}
                </div>
              )}
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardBody className="flex items-center gap-3">
                <Users className="h-8 w-8 text-teal-600" />
                <div>
                  <div className="text-xs text-slate-500">Capacity</div>
                  <div className="text-2xl font-bold">
                    {v.capacity.toLocaleString()}
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <Ruler className="h-8 w-8 text-teal-600" />
                <div>
                  <div className="text-xs text-slate-500">Pitch</div>
                  <div className="text-lg font-bold">
                    {v.pitchLength} × {v.pitchWidth} m
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
