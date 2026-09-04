import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSun, Thermometer, Wind, Droplets } from "lucide-react";

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
          Kick-off conditions · demo forecast (no external API)
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
              ? `${match.weatherWindKph} kph W`
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
      <Card>
        <CardHeader>
          <CardTitle>On-air notes</CardTitle>
        </CardHeader>
        <CardBody className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            Partly cloudy with a brisk westerly — expect the ball to hold up
            when attacking the West Stand in the first half. Surface is hybrid
            grass and should play true; light dew possible after sunset.
          </p>
          <p className="text-xs text-slate-400">
            Last refreshed: demo seed · not live meteorological data
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
