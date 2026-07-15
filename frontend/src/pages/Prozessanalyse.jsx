import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const BACKEND_URL = "http://localhost:8000";

function formatDauer(sekunden) {
  if (sekunden < 60) return `${sekunden.toFixed(1)} Sek.`;
  if (sekunden < 3600) return `${(sekunden / 60).toFixed(1)} Min.`;
  if (sekunden < 86400) return `${(sekunden / 3600).toFixed(1)} Std.`;
  return `${(sekunden / 86400).toFixed(1)} Tage`;
}

export default function Prozessanalyse() {
  const [engpaesse, setEngpaesse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/engpaesse`)
      .then((res) => res.json())
      .then((data) => {
        if (data.available) {
          setEngpaesse(data.engpaesse);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-semibold mb-2">Prozessanalyse</h1>
        <p className="text-gray-600">Daten werden geladen…</p>
      </div>
    );
  }

  if (!engpaesse) {
    return (
      <div>
        <h1 className="text-3xl font-semibold mb-2">Prozessanalyse</h1>
        <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <span className="text-blue-800 font-medium">Keine Daten vorhanden</span>
          </div>
          <p className="text-blue-700 text-sm">
            Um die Prozessanalyse anzuzeigen, müssen Sie zuerst einen Event Log hochladen.
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

  const maxDurchschnitt = engpaesse[0]?.durchschnitt_sekunden || 1;

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Prozessanalyse</h1>
      <p className="text-gray-600 mb-8">
        Analyse der Prozessschritte und Engpässe.
      </p>

      <h2 className="text-lg font-semibold mb-4">Engpässe (Aktivitätsebene)</h2>
      <p className="text-gray-500 text-sm mb-4">
        Durchschnittliche Verweildauer pro Aktivität (sortiert nach längster Dauer).
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 font-medium text-gray-700">Aktivität</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Ø Dauer</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Median</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Maximum</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Anzahl</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {engpaesse.map((e, i) => {
              const barWidth = (e.durchschnitt_sekunden / maxDurchschnitt) * 100;
              return (
                <tr key={e.aktivitaet} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="px-6 py-3 font-medium text-gray-900">{e.aktivitaet}</td>
                  <td className="px-6 py-3 text-gray-700">{formatDauer(e.durchschnitt_sekunden)}</td>
                  <td className="px-6 py-3 text-gray-700">{formatDauer(e.median_sekunden)}</td>
                  <td className="px-6 py-3 text-gray-700">{formatDauer(e.maximum_sekunden)}</td>
                  <td className="px-6 py-3 text-gray-700">{e.anzahl.toLocaleString("de-DE")}</td>
                  <td className="px-6 py-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: i === 0 ? "#dc2626" : i <= 2 ? "#f59e0b" : "#7c3aed",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
