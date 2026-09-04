import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSun, Thermometer, Wind, Droplets, MapPin } from "lucide-react";

export default async function WeatherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Weather</h2>
        <p className="text-sm text-slate-500">
          Kick-off conditions via Open-Meteo
          {match.venue
            ? ` · ${match.venue.name}, ${match.venue.city}`
            : " · sync match to link venue"}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          icon={<CloudSun className="h-5 w-5" />}
          label="Summary"
          value={match.weatherSummary || "—"}
        />
        <Metric
          icon={<Thermometer className="h-5 w-5" />}
          label="Temperature"
          value={
            match.weatherTempC != null ? `${match.weatherTempC}°C` : "—"
          }
        />
        <Metric
          icon={<Wind className="h-5 w-5" />}
          label="Wind"
          value={
            match.weatherWindKph != null
              ? `${match.weatherWindKph} kph`
              : "—"
          }
        />
        <Metric
          icon={<Droplets className="h-5 w-5" />}
          label="Humidity"
          value={
            match.weatherHumidity != null ? `${match.weatherHumidity}%` : "—"
          }
        />
      </div>
      {match.venue && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Venue
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            <div className="font-semibold">{match.venue.name}</div>
            <div className="text-slate-500">
              {match.venue.city}
              {match.venue.capacity
                ? ` · capacity ${match.venue.capacity.toLocaleString()}`
                : ""}
            </div>
            {match.venue.lat != null && match.venue.lon != null && (
              <div className="text-xs text-slate-400">
                {match.venue.lat.toFixed(3)}, {match.venue.lon.toFixed(3)}
              </div>
            )}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>On-air notes</CardTitle>
        </CardHeader>
        <CardBody className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            Weather is fetched from Open-Meteo for the kick-off hour at the
            venue city (or geocoded coordinates). Hit Sync on the desk to
            refresh.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 text-teal-600 mb-2">{icon}</div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-bold mt-0.5">{value}</div>
      </CardBody>
    </Card>
  );
}
