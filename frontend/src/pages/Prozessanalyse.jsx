import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const BACKEND_URL = "http://localhost:8000";

function formatDauer(sekunden, t) {
  if (sekunden < 60) return `${sekunden.toFixed(1)} ${t.common.secondsShort}`;
  if (sekunden < 3600) return `${(sekunden / 60).toFixed(1)} ${t.common.minutesShort}`;
  if (sekunden < 86400) return `${(sekunden / 3600).toFixed(1)} ${t.common.hoursShort}`;
  return `${(sekunden / 86400).toFixed(1)} ${t.common.days}`;
}

function formatSekundenGenau(sekunden, t) {
  return `${sekunden.toLocaleString(t.locale, { maximumFractionDigits: 1 })} ${
    t.locale === "de-DE" ? "Sekunden" : "seconds"
  }`;
}

function engpassSchwere(anteilProzent, t) {
  if (anteilProzent >= 40) {
    return { farbe: "#dc2626", label: t.bottleneck.critical, textFarbe: "text-red-700", badgeBg: "bg-red-100" };
  }
  if (anteilProzent >= 25) {
    return { farbe: "#f97316", label: t.bottleneck.high, textFarbe: "text-orange-700", badgeBg: "bg-orange-100" };
  }
  if (anteilProzent >= 10) {
    return { farbe: "#f59e0b", label: t.bottleneck.medium, textFarbe: "text-amber-700", badgeBg: "bg-amber-100" };
  }
  return { farbe: "#7c3aed", label: t.bottleneck.low, textFarbe: "text-purple-700", badgeBg: "bg-purple-100" };
}

export default function Prozessanalyse() {
  const { t } = useLanguage();
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
        <h1 className="text-3xl font-semibold mb-2">{t.bottleneck.title}</h1>
        <p className="text-gray-600">{t.common.loadingData}</p>
      </div>
    );
  }

  if (!engpaesse) {
    return (
      <div>
        <h1 className="text-3xl font-semibold mb-2">{t.bottleneck.title}</h1>
        <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <span className="text-blue-800 font-medium">{t.common.noDataTitle}</span>
          </div>
          <p className="text-blue-700 text-sm">
            {t.bottleneck.noDataMessage}
          </p>
          <Link
            to="/upload"
            className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
          >
            {t.common.upload}
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
      <h1 className="text-3xl font-semibold mb-8">{t.bottleneck.title}</h1>

      <h2 className="text-lg font-semibold mb-4">{t.bottleneck.largest}</h2>
      <div className="grid grid-cols-3 gap-6 mb-10">
        {top3.map((e, i) => {
          const schwere = engpassSchwere(e.anteil_cases_prozent, t);
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
                {e.cases_mit_bottleneck.toLocaleString(t.locale)} {t.bottleneck.of} {e.gesamt_anzahl_cases.toLocaleString(t.locale)} {t.common.cases} {t.bottleneck.affected}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {e.anzahl_bottlenecks.toLocaleString(t.locale)} {t.bottleneck.totalInstances}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mb-4">{t.bottleneck.activityLevel}</h2>

      <div className="mb-4 max-w-5xl bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2 text-sm text-blue-800">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <span>
              <strong>{t.bottleneck.calculationTitle}</strong> {t.bottleneck.calculationText}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm text-blue-800">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <span>
              <strong>{t.bottleneck.assumptionTitle}</strong> {t.bottleneck.assumptionText}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 font-medium text-gray-700">{t.bottleneck.activity}</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">{t.bottleneck.avgDuration}</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">{t.common.median}</th>
              <th className="text-left px-6 py-3 font-medium text-gray-700">{t.common.maximum}</th>
              <th
                className="text-left px-6 py-3 font-medium text-gray-700"
                title={t.bottleneck.bottleneckCountTitle}
              >
                {t.bottleneck.bottleneckCount}
              </th>
              <th
                className="text-left px-6 py-3 font-medium text-gray-700"
                title={t.bottleneck.shareCasesTitle}
              >
                {t.bottleneck.shareCases}
              </th>
              <th className="text-left px-6 py-3 font-medium text-gray-700 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {sortierteEngpaesse.map((e, i) => {
              const schwere = engpassSchwere(e.anteil_cases_prozent, t);
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
                  <td className="px-6 py-3 text-gray-700" title={formatSekundenGenau(e.durchschnitt_sekunden, t)}>
                    {formatDauer(e.durchschnitt_sekunden, t)}
                  </td>
                  <td className="px-6 py-3 text-gray-700" title={formatSekundenGenau(e.median_sekunden, t)}>
                    {formatDauer(e.median_sekunden, t)}
                  </td>
                  <td className="px-6 py-3 text-gray-700">{formatDauer(e.maximum_sekunden, t)}</td>
                  <td className="px-6 py-3 text-gray-700">{e.anzahl_bottlenecks.toLocaleString(t.locale)}</td>
                  <td className={`px-6 py-3 font-medium ${schwere.textFarbe}`}>
                    {e.anteil_cases_prozent.toFixed(1)}%
                    <span className="block text-xs font-normal text-gray-400">
                      {e.cases_mit_bottleneck.toLocaleString(t.locale)} {t.bottleneck.of} {e.gesamt_anzahl_cases.toLocaleString(t.locale)} {t.common.cases}
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
