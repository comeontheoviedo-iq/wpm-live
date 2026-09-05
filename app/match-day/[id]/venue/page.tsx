import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Ruler, ExternalLink, CloudSun } from "lucide-react";
import { splitVenueNames } from "@/lib/venue-name";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const v = match.venue;
  const names = v ? splitVenueNames(v.name) : null;
  const osm =
    v?.lat != null && v?.lon != null
      ? `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lon}#map=16/${v.lat}/${v.lon}`
      : v
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(
            `${v.name}, ${v.city}`
          )}`
        : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Venue</h2>
        <p className="text-sm text-slate-500">Ground intel for commentary</p>
      </div>
      {!v ? (
        <p className="text-sm text-slate-500">
          No venue linked — Sync to load from API-Football.
        </p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-4 w-4 text-teal-600" />
                {names?.primary || v.name}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              {v.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.imageUrl}
                  alt={v.name}
                  className="w-full max-h-56 object-cover rounded-xl border border-slate-100 dark:border-slate-800"
                />
              )}

              {(names?.sponsored || names?.historic) && (
                <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-teal-100 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 p-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      Sponsored name
                    </div>
                    <div className="font-semibold mt-0.5">
                      {names?.sponsored || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      Original / historic name
                    </div>
                    <div className="font-semibold mt-0.5">
                      {names?.historic || "—"}
                    </div>
                  </div>
                  {names?.sponsored && names?.historic ? null : (
                    <p className="sm:col-span-2 text-[11px] text-slate-500">
                      Full AF name: {v.name}
                    </p>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Info label="City" value={v.city} />
                <Info label="Address" value={v.address || "—"} />
                <Info label="Surface" value={v.surface} />
                <Info label="Opened" value={v.opened ? String(v.opened) : "—"} />
              </div>
              {osm && (
                <a
                  href={osm}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in OpenStreetMap
                </a>
              )}
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
                    {v.capacity ? v.capacity.toLocaleString() : "—"}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CloudSun className="h-4 w-4 text-teal-600" />
                  Weather
                </CardTitle>
              </CardHeader>
              <CardBody className="text-sm space-y-1">
                {match.weatherSummary || match.weatherTempC != null ? (
                  <>
                    <div className="font-semibold">
                      {match.weatherSummary || "Conditions"}
                    </div>
                    <div className="text-slate-500">
                      {match.weatherTempC != null
                        ? `${match.weatherTempC}°C`
                        : ""}
                      {match.weatherWindKph != null
                        ? ` · ${match.weatherWindKph} kph`
                        : ""}
                      {match.weatherHumidity != null
                        ? ` · ${match.weatherHumidity}% humidity`
                        : ""}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 text-xs">
                    Sync to load kick-off weather.
                  </p>
                )}
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
