import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import { useKiAuswertungState } from "../context/KiAuswertungContext";
import { useLanguage } from "../context/LanguageContext";

const BACKEND_URL = "http://localhost:8000";
const MAX_GENERATIONS = 3;
const MAX_CHAT_MESSAGES = 10;

function formatiereInlineText(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((teil, i) =>
    teil.startsWith("**") && teil.endsWith("**")
      ? <strong key={i}>{teil.slice(2, -2)}</strong>
      : <span key={i}>{teil}</span>
  );
}

function renderAnalyseText(text) {
  const zeilen = text.split("\n");
  const elemente = [];
  let listenPuffer = [];

  const listeAbschliessen = (key) => {
    if (listenPuffer.length > 0) {
      elemente.push(
        <ul key={`ul-${key}`} className="list-disc list-inside space-y-1 mb-3 ml-1 text-gray-700">
          {listenPuffer}
        </ul>
      );
      listenPuffer = [];
    }
  };

  zeilen.forEach((zeile, i) => {
    const trimmed = zeile.trim();

    if (trimmed === "") {
      listeAbschliessen(i);
      return;
    }

    if (/^-{3,}$/.test(trimmed)) {
      listeAbschliessen(i);
      elemente.push(<hr key={`hr-${i}`} className="my-4 border-gray-200" />);
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      listeAbschliessen(i);
      const ebene = headingMatch[1].length;
      const klasse =
        ebene === 1 ? "text-xl font-semibold mt-5 mb-2" :
        ebene === 2 ? "text-lg font-semibold mt-4 mb-2" :
        "text-base font-semibold mt-4 mb-1";
      elemente.push(
        <p key={`h-${i}`} className={`${klasse} text-gray-900`}>
          {formatiereInlineText(headingMatch[2])}
        </p>
      );
      return;
    }

    const listMatch = trimmed.match(/^[*-]\s+(.*)$/);
    if (listMatch) {
      listenPuffer.push(<li key={`li-${i}`}>{formatiereInlineText(listMatch[1])}</li>);
      return;
    }

    listeAbschliessen(i);
    elemente.push(
      <p key={`p-${i}`} className="mb-2 text-gray-700">
        {formatiereInlineText(trimmed)}
      </p>
    );
  });

  listeAbschliessen("ende");
  return elemente;
}

function TraceChips({ trace }) {
  const aktivitaeten = trace.split(" -> ");
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {aktivitaeten.map((aktivitaet, j) => (
        <span key={j} className="flex items-center gap-1.5">
          <span className="inline-block bg-gray-200 text-gray-900 font-medium text-xs rounded-full px-2.5 py-1">
            {aktivitaet}
          </span>
          {j < aktivitaeten.length - 1 && <span className="text-gray-500 text-xs">→</span>}
        </span>
      ))}
    </div>
  );
}

function ChatTab({ datenVorhanden, messages, setMessages }) {
  const { language, t } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!datenVorhanden) {
    return (
      <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-blue-500">info</span>
          <span className="text-blue-800 font-medium">{t.common.noDataTitle}</span>
        </div>
        <p className="text-blue-700 text-sm">
          {t.ai.chat.noDataMessage}
        </p>
        <Link
          to="/upload"
          className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
        >
          {t.common.upload}
        </Link>
      </div>
    );
  }

  const chatCount = messages.filter((m) => m.rolle === "user").length;
  const chatLimitReached = chatCount >= MAX_CHAT_MESSAGES;

  async function sendeFrage(frage) {
    if (!frage.trim() || loading || chatLimitReached) return;

    const verlauf = messages.map((m) => ({ rolle: m.rolle, text: m.text }));
    setMessages((prev) => [...prev, { rolle: "user", text: frage }]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frage, verlauf, language }),
      });
      const data = await res.json();
      if (!data.available) {
        setError(data.error || t.ai.chat.answerFailed);
        return;
      }
      setMessages((prev) => [...prev, { rolle: "assistant", text: data.antwort }]);
    } catch (e) {
      setError(t.common.errorPrefix + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-gray-500 mb-2">
        {t.ai.chat.messages}: {chatCount}/{MAX_CHAT_MESSAGES}
      </p>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col" style={{ height: "500px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div>
              <p className="text-gray-500 text-sm mb-3">
                {t.ai.chat.intro}
              </p>
              <p className="text-gray-500 text-xs mb-2">{t.ai.chat.examples}</p>
              <div className="flex flex-wrap gap-2">
                {t.ai.suggestions.map((frage) => (
                  <button
                    key={frage}
                    onClick={() => sendeFrage(frage)}
                    disabled={chatLimitReached}
                    className="text-xs text-left px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {frage}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.rolle === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                  m.rolle === "user"
                    ? "bg-primary text-white whitespace-pre-wrap"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {m.rolle === "user" ? m.text : renderAnalyseText(m.text)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[75%] px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-500">
                {t.ai.chat.generating}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {chatLimitReached && (
          <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-yellow-800 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-600 text-base">warning</span>
            {t.ai.chat.limitMessage.replaceAll("{limit}", MAX_CHAT_MESSAGES)}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); sendeFrage(input); }}
          className="border-t border-gray-200 p-3 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatLimitReached ? t.ai.chat.limitUsed : t.ai.chat.placeholder}
            disabled={chatLimitReached}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || chatLimitReached}
            className="bg-primary text-white font-medium rounded-lg px-5 py-2 text-sm hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t.ai.chat.send}
          </button>
        </form>
      </div>
    </div>
  );
}

function AbweichungsanalyseTab({
  datenVorhanden, varianten, bpmnFile, setBpmnFile,
  analyseVarianten, setAnalyseVarianten, abweichungen, setAbweichungen, zusammenfassung, setZusammenfassung,
}) {
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef(null);

  if (!datenVorhanden) {
    return (
      <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-blue-500">info</span>
          <span className="text-blue-800 font-medium">{t.common.noDataTitle}</span>
        </div>
        <p className="text-blue-700 text-sm">
          {t.ai.deviation.noDataMessage}
        </p>
        <Link
          to="/upload"
          className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
        >
          {t.common.upload}
        </Link>
      </div>
    );
  }

  function handleFile(f) {
    if (f && f.name.toLowerCase().endsWith(".bpmn")) {
      setBpmnFile(f);
      setAnalyseVarianten(null);
      setAbweichungen(null);
      setZusammenfassung(null);
      setError(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function analysieren() {
    if (loading) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    if (bpmnFile) {
      formData.append("file", bpmnFile);
    }
    formData.append("language", language);

    try {
      const res = await fetch(`${BACKEND_URL}/abweichungsanalyse`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.available) {
        setError(data.error || t.ai.deviation.failed);
        return;
      }
      setAnalyseVarianten(data.varianten);
      setAbweichungen(data.abweichungen);
      setZusammenfassung(data.zusammenfassung);
    } catch (e) {
      setError(t.common.errorPrefix + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-gray-500 text-sm mb-4">
        {t.ai.deviation.description.replace("{count}", varianten?.length || 0)}
      </p>

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        className={`max-w-xl border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragover
            ? "border-primary bg-primary-light"
            : "border-border-purple hover:border-primary hover:bg-primary-light"
        }`}
      >
        <span className="material-symbols-outlined text-4xl text-primary mb-2 block">upload_file</span>
        <p className="text-purple-700 text-sm">
          {bpmnFile ? bpmnFile.name : t.ai.deviation.dropzone}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".bpmn"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {!bpmnFile && varianten?.[0] && (
        <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800 whitespace-nowrap">
          <span className="material-symbols-outlined text-blue-500">info</span>
          <span>
            <strong>{t.ai.deviation.noTargetTitle}</strong> - {t.ai.deviation.noTargetText}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={analysieren}
          disabled={loading}
          className="bg-primary text-white font-medium rounded-lg px-6 py-2 text-sm hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t.ai.deviation.running : t.ai.deviation.start}
        </button>
        {bpmnFile && (
          <button
            onClick={() => setBpmnFile(null)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t.ai.deviation.removeFile}
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 text-gray-500 rounded-lg px-4 py-3 text-sm whitespace-nowrap">
          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
          Die Abweichungsanalyse wird generiert…
        </div>
      )}

      {error && (
        <div className="mt-4 max-w-xl p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {analyseVarianten?.length > 0 && (
        <div className="mt-6 space-y-6 max-w-5xl">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">fact_check</span>
              {t.ai.actualFlow}
            </h2>
            <div className="space-y-5">
              {analyseVarianten.map((v, i) => {
                const eintrag =
                  abweichungen?.find((a) => a.index === i + 1) || abweichungen?.[i];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-5 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-light text-primary text-xs font-semibold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          {v.anteil}% {t.common.cases} · {v.anzahl.toLocaleString(t.locale)} {t.common.cases}
                        </p>
                        <TraceChips trace={v.trace} />
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {eintrag?.text || t.ai.noAnalysis}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {zusammenfassung && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">summarize</span>
                {t.ai.summary}
              </h2>
              <div className="text-sm">{renderAnalyseText(zusammenfassung)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KiAuswertung() {
  const { t } = useLanguage();
  const {
    activeTab, setActiveTab,
    varianten, setVarianten,
    gesamtAnzahlVarianten, setGesamtAnzahlVarianten,
    bpmnCache, setBpmnCache,
    activeIdx, setActiveIdx,
    generationCount, setGenerationCount,
    chatMessages, setChatMessages,
    bpmnFile, setBpmnFile,
    analyseVarianten, setAnalyseVarianten,
    abweichungen, setAbweichungen,
    zusammenfassung, setZusammenfassung,
  } = useKiAuswertungState();

  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/varianten`)
      .then((res) => res.json())
      .then((data) => {
        if (data.available) {
          setVarianten(data.varianten);
          setGesamtAnzahlVarianten(data.gesamt_anzahl_varianten);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const xml = bpmnCache[activeIdx];
    if (!xml || !containerRef.current) return;

    let abgebrochen = false;
    const viewer = new BpmnViewer({ container: containerRef.current });
    viewerRef.current = viewer;

    viewer.importXML(xml).then(({ warnings }) => {
      if (abgebrochen) return;
      if (warnings.length) console.warn("BPMN warnings:", warnings);
      const canvas = viewer.get("canvas");
      canvas.zoom("fit-viewport");
      const bbox = canvas.viewbox();
      const height = Math.min(Math.max(bbox.inner.height + 120, 250), 650);
      containerRef.current.style.height = height + "px";
      canvas.zoom("fit-viewport");
      canvas.zoom(canvas.zoom() * 0.85);
    }).catch((err) => {
      if (abgebrochen) return;
      setError(t.ai.bpmnFailed + err.message);
    });

    return () => {
      abgebrochen = true;
      viewer.destroy();
    };
  }, [activeIdx, bpmnCache]);

  async function generateForIndex(idx, trace) {
    if (bpmnCache[idx]) {
      setActiveIdx(idx);
      return;
    }

    setGeneratingIdx(idx);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/bpmn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace }),
      });
      const data = await res.json();
      if (!data.available) {
        setError(data.error || t.ai.generationFailed);
        return;
      }
      setBpmnCache((prev) => ({ ...prev, [idx]: data.bpmn_xml }));
      setGenerationCount((c) => c + 1);
      setActiveIdx(idx);
    } catch (e) {
      setError(t.common.errorPrefix + e.message);
    } finally {
      setGeneratingIdx(null);
    }
  }

  const tabs = [
    { id: "prozessmodell", label: t.ai.tabs.processModel },
    { id: "abweichungsanalyse", label: t.ai.tabs.deviation },
    { id: "chat", label: t.ai.tabs.chat },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">{t.ai.title}</h1>

      <div className="mb-6 max-w-2xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-blue-500 text-lg">info</span>
          <p>
            {activeTab === "prozessmodell"
              ? t.ai.warnings.processModel
              : activeTab === "abweichungsanalyse"
              ? t.ai.warnings.deviation
              : t.ai.warnings.chat}
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "prozessmodell" && (
        <>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {varianten && (
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-primary">account_tree</span>
                  <span className="text-sm text-gray-500">{t.ai.totalVariants}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {gesamtAnzahlVarianten != null ? gesamtAnzahlVarianten.toLocaleString(t.locale) : "-"}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-primary">pie_chart</span>
                  <span className="text-sm text-gray-500">{t.ai.topCoverage}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {varianten.reduce((summe, v) => summe + v.anteil, 0).toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {generatingIdx != null && (
            <div className="mt-6 max-w-xl flex items-center gap-2 bg-gray-100 text-gray-500 rounded-lg px-4 py-3 text-sm">
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              {t.ai.generatingModel.replace("{idx}", generatingIdx + 1)}
            </div>
          )}

          {bpmnCache[activeIdx] && (
            <div className="mt-6">
              <h2 className="text-xl font-medium mb-3">{t.ai.bpmnHeading} {activeIdx + 1}</h2>
              <div
                ref={containerRef}
                className="w-full border border-gray-200 rounded-lg bg-white overflow-hidden p-4"
                style={{ height: "350px" }}
              />
            </div>
          )}

          {!varianten && (
            <div className="mt-6 max-w-xl bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-blue-500">info</span>
                <span className="text-blue-800 font-medium">Keine Daten vorhanden</span>
              </div>
              <p className="text-blue-700 text-sm">
                Um die Prozessvarianten anzuzeigen, müssen Sie zuerst einen Event Log hochladen.
              </p>
              <Link
                to="/upload"
                className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
              >
                Zum Upload
              </Link>
            </div>
          )}

          {varianten && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">{t.ai.topVariants}</h2>
                <span className="text-sm text-gray-500">
                  {t.ai.generations}: {generationCount}/{MAX_GENERATIONS}
                </span>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-6 py-3 font-medium text-gray-700 w-12">#</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-700">{t.ai.variant}</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-700 w-28">{t.common.count}</th>
                      <th
                        className="text-left px-6 py-3 font-medium text-gray-700 w-40"
                        title={t.ai.shareTitle}
                      >
                        {t.ai.share}
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-gray-700 w-32">{t.ai.processModel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {varianten.map((v, i) => {
                      const isActive = activeIdx === i;
                      const isCached = !!bpmnCache[i];
                      const isGenerating = generatingIdx === i;
                      const limitReached = generationCount >= MAX_GENERATIONS && !isCached;

                      return (
                        <tr
                          key={i}
                          className={isActive ? "bg-blue-50" : i % 2 === 0 ? "" : "bg-gray-50"}
                        >
                          <td className="px-6 py-4 align-top">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-light text-primary text-xs font-semibold">
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <TraceChips trace={v.trace} />
                          </td>
                          <td className="px-6 py-4 align-top text-gray-700">
                            {v.anzahl.toLocaleString(t.locale)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="text-gray-700 mb-1">{v.anteil}%</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-primary"
                                style={{ width: `${Math.min(v.anteil, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            {isActive && isCached ? (
                              <span className="inline-block px-3 py-1 text-xs bg-gray-200 text-gray-500 rounded-lg cursor-default">
                                {t.ai.shown}
                              </span>
                            ) : isCached ? (
                              <button
                                onClick={() => setActiveIdx(i)}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              >
                                {t.ai.show}
                              </button>
                            ) : (
                              <button
                                onClick={() => generateForIndex(i, v.trace)}
                                disabled={isGenerating || limitReached}
                                title={t.ai.generateTooltip}
                                className="px-3 py-1 text-xs bg-primary text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {isGenerating ? t.ai.generating : limitReached ? t.ai.limitReached : t.ai.generate}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "chat" && (
        <ChatTab datenVorhanden={!!varianten} messages={chatMessages} setMessages={setChatMessages} />
      )}

      {activeTab === "abweichungsanalyse" && (
        <AbweichungsanalyseTab
          datenVorhanden={!!varianten}
          varianten={varianten}
          bpmnFile={bpmnFile}
          setBpmnFile={setBpmnFile}
          analyseVarianten={analyseVarianten}
          setAnalyseVarianten={setAnalyseVarianten}
          abweichungen={abweichungen}
          setAbweichungen={setAbweichungen}
          zusammenfassung={zusammenfassung}
          setZusammenfassung={setZusammenfassung}
        />
      )}
    </div>
  );
}
