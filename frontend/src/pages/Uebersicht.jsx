import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const BACKEND_URL = "http://localhost:8000";

function getDurchschnittBucket(verteilung) {
  const sek = verteilung.durchschnitt_sekunden;
  const buckets = verteilung.buckets;
  // Parse the bucket label to find which one contains the average
  // Labels are like "30d–60d", parse the start value
  for (let i = buckets.length - 1; i >= 0; i--) {
    const match = buckets[i].label.match(/^([\d.]+)(m|h|d)/);
    if (!match) continue;
    const val = parseFloat(match[1]);
    const unit = match[2];
    const startSek = unit === "m" ? val * 60 : unit === "h" ? val * 3600 : val * 86400;
    if (sek >= startSek) return buckets[i].label;
  }
  return buckets[0].label;
}

function formatDauer(sekunden) {
  if (sekunden < 60) return `${sekunden.toFixed(1)} Sek.`;
  if (sekunden < 3600) return `${(sekunden / 60).toFixed(1)} Min.`;
  if (sekunden < 86400) return `${(sekunden / 3600).toFixed(1)} Std.`;
  return `${(sekunden / 86400).toFixed(1)} Tage`;
}

export default function Uebersicht() {
  const location = useLocation();
  const [kpis, setKpis] = useState(location.state?.kpis || null);
  const [filename, setFilename] = useState(location.state?.filename || null);
  const [verteilung, setVerteilung] = useState(null);
  const [loading, setLoading] = useState(!location.state?.kpis);

  useEffect(() => {
    if (kpis) return;
    fetch(`${BACKEND_URL}/kpis`)
      .then((res) => res.json())
      .then((data) => {
        if (data.available) {
          setKpis(data.kpis);
          setFilename(data.filename);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/durchlaufzeit-verteilung`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.available) setVerteilung(data.verteilung);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold mb-2">Übersicht</h1>
        <p className="text-gray-600">Daten werden geladen…</p>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div>
        <h1 className="text-3xl font-semibold mb-2">Übersicht</h1>
        <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <span className="text-blue-800 font-medium">Keine Daten vorhanden</span>
          </div>
          <p className="text-blue-700 text-sm">
            Um die Übersicht anzuzeigen, müssen Sie zuerst einen Event Log hochladen.
          </p>
          <Link
            to="/upload"
            className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
          >
            Zum Upload
          </Link>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Anzahl Cases", value: kpis.anzahl_cases, icon: "folder_open" },
    { label: "Anzahl Events", value: kpis.anzahl_events, icon: "event" },
    { label: "Anzahl Aktivitäten", value: kpis.anzahl_aktivitaeten, icon: "category" },
  ];

  const durchlaufzeitCards = [
    { label: "Minimum", value: formatDauer(kpis.durchlaufzeit_min_sekunden), icon: "timer" },
    { label: "Maximum", value: formatDauer(kpis.durchlaufzeit_max_sekunden), icon: "timer" },
    { label: "Durchschnitt", value: formatDauer(kpis.durchlaufzeit_durchschnitt_sekunden), icon: "avg_pace" },
    { label: "Median", value: formatDauer(kpis.durchlaufzeit_median_sekunden), icon: "middle" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Übersicht</h1>
      <p className="text-gray-600 mb-8">
        Kennzahlen für <span className="font-medium text-gray-900">{filename}</span>.
      </p>

      <h2 className="text-lg font-semibold mb-4">Allgemein</h2>
      <div className="grid grid-cols-3 gap-6 mb-10">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
              <span className="text-sm text-gray-500">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value.toLocaleString("de-DE")}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4">Durchlaufzeit</h2>
      <div className="grid grid-cols-4 gap-6 mb-10">
        {durchlaufzeitCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
              <span className="text-sm text-gray-500">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {verteilung && (
        <>
          <h2 className="text-lg font-semibold mb-4">Durchlaufzeitverteilung</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={verteilung.buckets}
                margin={{ top: 24, right: 16, bottom: 40, left: 16 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e1e0d9"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#898781", fontSize: 11 }}
                  axisLine={{ stroke: "#c3c2b7" }}
                  tickLine={false}
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={70}
                  label={{ value: "Durchlaufzeit", position: "bottom", offset: 4, fill: "#52514e", fontSize: 13 }}
                />
                <YAxis
                  tick={{ fill: "#898781", fontSize: 12 }}
                  axisLine={{ stroke: "#c3c2b7" }}
                  tickLine={false}
                  allowDecimals={false}
                  label={{ value: "Anzahl Fälle", angle: -90, position: "insideLeft", offset: -4, fill: "#52514e", fontSize: 13 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fcfcfb",
                    border: "1px solid #e1e0d9",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "#0b0b0b", fontWeight: 600 }}
                  itemStyle={{ color: "#52514e" }}
                  formatter={(value) => [`${value} Cases`, "Anzahl"]}
                />
                <ReferenceLine
                  x={getDurchschnittBucket(verteilung)}
                  stroke="#0b0b0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: "Ø Durchlaufzeit", position: "top", fill: "#52514e", fontSize: 12 }}
                />
                <Bar
                  dataKey="anzahl"
                  fill="#7c3aed"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
              <span className="material-symbols-outlined text-gray-400">info</span>
              Die Grafik zeigt die Verteilung der Durchlaufzeiten aller Cases.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
