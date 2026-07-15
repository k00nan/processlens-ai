import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

const BACKEND_URL = "http://localhost:8000";

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
      <div className="grid grid-cols-4 gap-6">
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
    </div>
  );
}
