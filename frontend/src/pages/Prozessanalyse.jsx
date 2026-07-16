import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const BACKEND_URL = "http://localhost:8000";

function formatDauer(sekunden) {
  if (sekunden < 60) return `${sekunden.toFixed(1)} Sek.`;
  if (sekunden < 3600) return `${(sekunden / 60).toFixed(1)} Min.`;
  if (sekunden < 86400) return `${(sekunden / 3600).toFixed(1)} Std.`;
  return `${(sekunden / 86400).toFixed(1)} Tage`;
}

function formatSekundenGenau(sekunden) {
  return `${sekunden.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Sekunden`;
}

function engpassSchwere(anteilProzent) {
  if (anteilProzent >= 40) {
    return { farbe: "#dc2626", label: "Kritisch", textFarbe: "text-red-700", badgeBg: "bg-red-100" };
  }
  if (anteilProzent >= 25) {
    return { farbe: "#f97316", label: "Hoch", textFarbe: "text-orange-700", badgeBg: "bg-orange-100" };
  }
  if (anteilProzent >= 10) {
    return { farbe: "#f59e0b", label: "Mittel", textFarbe: "text-amber-700", badgeBg: "bg-amber-100" };
  }
  return { farbe: "#7c3aed", label: "Gering", textFarbe: "text-purple-700", badgeBg: "bg-purple-100" };
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

  const sortierteEngpaesse = [...engpaesse].sort(
    (a, b) => b.anteil_cases_prozent - a.anteil_cases_prozent
  );
  const top3 = sortierteEngpaesse.slice(0, 3);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Prozessanalyse</h1>
      <p className="text-gray-600 mb-8">
        Analyse der Prozessschritte und Engpässe.
      </p>

      <h2 className="text-lg font-semibold mb-4">Größte Engpässe</h2>
      <div className="grid grid-cols-3 gap-6 mb-10">
        {top3.map((e, i) => {
          const schwere = engpassSchwere(e.anteil_cases_prozent);
          return (
            <div key={e.aktivitaet} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined" style={{ color: schwere.farbe }}>
                  {i === 0 ? "warning" : "priority_high"}
                </span>
                <span className="text-sm text-gray-500">#{i + 1} {schwere.label}</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">{e.aktivitaet}</p>
              <p className="text-3xl font-bold" style={{ color: schwere.farbe }}>
                {e.anteil_cases_prozent.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {e.cases_mit_bottleneck.toLocaleString("de-DE")} von {e.gesamt_anzahl_cases.toLocaleString("de-DE")} Cases betroffen
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {e.anzahl_bottlenecks.toLocaleString("de-DE")} Bottleneck-Instanzen insgesamt
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mb-4">Engpässe (Aktivitätsebene)</h2>
      <p className="text-gray-500 text-sm mb-4">
        Verweildauer pro Aktivität, sortiert nach Anteil an Cases mit Bottleneck.
      </p>

      <div className="mb-4 max-w-3xl flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
        <span className="material-symbols-outlined text-blue-500">info</span>
        <span>
          <strong>Wie wird ein Bottleneck berechnet?</strong> Ein einzelner Durchlauf einer
          Aktivität (in einem konkreten Case) gilt als Bottleneck, wenn seine Dauer die
          Ausreißergrenze dieser Aktivität überschreitet (Q3 + 1,5 × Interquartilsabstand,
          Tukey-Methode). Dieses Maß berücksichtigt die natürliche Streuung jeder Aktivität,
          statt einen festen Anteil an Instanzen zu markieren.
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 font-medium text-gray-700">Aktivität</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Ø Dauer</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Median</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">Maximum</th>
              <th
                className="text-left px-6 py-3 font-medium text-gray-700"
                title="Anzahl der Instanzen dieser Aktivität, deren Dauer über der Ausreißergrenze (Q3 + 1,5 × IQR) liegt"
              >
                Anzahl Bottlenecks
              </th>
              <th
                className="text-left px-6 py-3 font-medium text-gray-700"
                title="Anteil aller Cases im Event Log, in denen diese Aktivität mindestens einmal zum Bottleneck wurde"
              >
                Anteil an Cases
              </th>
              <th className="text-left px-6 py-3 font-medium text-gray-700 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {sortierteEngpaesse.map((e, i) => {
              const schwere = engpassSchwere(e.anteil_cases_prozent);
              const barWidth = Math.min(e.anteil_cases_prozent, 100);
              return (
                <tr key={e.aktivitaet} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {e.aktivitaet}
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${schwere.textFarbe} ${schwere.badgeBg}`}
                      >
                        {schwere.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-700" title={formatSekundenGenau(e.durchschnitt_sekunden)}>
                    {formatDauer(e.durchschnitt_sekunden)}
                  </td>
                  <td className="px-6 py-3 text-gray-700" title={formatSekundenGenau(e.median_sekunden)}>
                    {formatDauer(e.median_sekunden)}
                  </td>
                  <td className="px-6 py-3 text-gray-700">{formatDauer(e.maximum_sekunden)}</td>
                  <td className="px-6 py-3 text-gray-700">{e.anzahl_bottlenecks.toLocaleString("de-DE")}</td>
                  <td className={`px-6 py-3 font-medium ${schwere.textFarbe}`}>
                    {e.anteil_cases_prozent.toFixed(1)}%
                    <span className="block text-xs font-normal text-gray-400">
                      {e.cases_mit_bottleneck.toLocaleString("de-DE")} von {e.gesamt_anzahl_cases.toLocaleString("de-DE")} Cases
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${barWidth}%`, backgroundColor: schwere.farbe }}
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
