import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";

const BACKEND_URL = "http://localhost:8000";
const MAX_GENERATIONS = 3;

const VORSCHLAEGE = [
  "Welche Aktivität ist der größte Engpass und warum?",
  "Wie lange dauert der Prozess im Durchschnitt bis zum Abschluss?",
  "Welche drei Verbesserungsmaßnahmen würdest du empfehlen?",
  "Gibt es Aktivitäten, die auffällig oft zu Engpässen führen?",
];

function ChatTab({ datenVorhanden }) {
  const [messages, setMessages] = useState([]);
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
          <span className="text-blue-800 font-medium">Keine Daten vorhanden</span>
        </div>
        <p className="text-blue-700 text-sm">
          Um Fragen zum Event Log zu stellen, müssen Sie zuerst einen Event Log hochladen.
        </p>
        <Link
          to="/upload"
          className="inline-block mt-4 bg-primary text-white font-medium rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
        >
          Zum Upload
        </Link>
      </div>
    );
  }

  async function sendeFrage(frage) {
    if (!frage.trim() || loading) return;

    const verlauf = messages.map((m) => ({ rolle: m.rolle, text: m.text }));
    setMessages((prev) => [...prev, { rolle: "user", text: frage }]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frage, verlauf }),
      });
      const data = await res.json();
      if (!data.available) {
        setError(data.error || "Antwort fehlgeschlagen.");
        return;
      }
      setMessages((prev) => [...prev, { rolle: "assistant", text: data.antwort }]);
    } catch (e) {
      setError("Fehler: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col" style={{ height: "500px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div>
              <p className="text-gray-500 text-sm mb-3">
                Stellen Sie eine offene Frage zum Event Log — die Antwort basiert auf den berechneten
                Kennzahlen und Engpässen.
              </p>
              <p className="text-gray-500 text-xs mb-2">Beispiele:</p>
              <div className="flex flex-wrap gap-2">
                {VORSCHLAEGE.map((frage) => (
                  <button
                    key={frage}
                    onClick={() => sendeFrage(frage)}
                    className="text-xs text-left px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
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
                className={`max-w-[75%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                  m.rolle === "user"
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[75%] px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-500">
                Antwort wird generiert…
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

        <form
          onSubmit={(e) => { e.preventDefault(); sendeFrage(input); }}
          className="border-t border-gray-200 p-3 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage zum Event Log stellen…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-primary text-white font-medium rounded-lg px-5 py-2 text-sm hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Senden
          </button>
        </form>
      </div>
    </div>
  );
}

export default function KiAuswertung() {
  const [activeTab, setActiveTab] = useState("prozessmodell");
  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [error, setError] = useState(null);
  const [varianten, setVarianten] = useState(null);
  const [bpmnCache, setBpmnCache] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [generationCount, setGenerationCount] = useState(0);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/varianten`)
      .then((res) => res.json())
      .then((data) => {
        if (data.available) setVarianten(data.varianten);
      })
      .catch(() => {});
    return () => { if (viewerRef.current) viewerRef.current.destroy(); };
  }, []);

  useEffect(() => {
    const xml = bpmnCache[activeIdx];
    if (!xml || !containerRef.current) return;

    if (viewerRef.current) viewerRef.current.destroy();

    const viewer = new BpmnViewer({ container: containerRef.current });
    viewerRef.current = viewer;

    viewer.importXML(xml).then(({ warnings }) => {
      if (warnings.length) console.warn("BPMN warnings:", warnings);
      const canvas = viewer.get("canvas");
      canvas.zoom("fit-viewport");
      const bbox = canvas.viewbox();
      const height = Math.min(Math.max(bbox.inner.height + 120, 250), 650);
      containerRef.current.style.height = height + "px";
      canvas.zoom("fit-viewport");
      canvas.zoom(canvas.zoom() * 0.85);
    }).catch((err) => {
      setError("BPMN-Rendering fehlgeschlagen: " + err.message);
    });
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
        setError(data.error || "BPMN-Generierung fehlgeschlagen.");
        return;
      }
      setBpmnCache((prev) => ({ ...prev, [idx]: data.bpmn_xml }));
      setGenerationCount((c) => c + 1);
      setActiveIdx(idx);
    } catch (e) {
      setError("Fehler: " + e.message);
    } finally {
      setGeneratingIdx(null);
    }
  }

  const tabs = [
    { id: "prozessmodell", label: "Prozessmodell" },
    { id: "chat", label: "Chat" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">KI-Auswertung</h1>
      <p className="text-gray-600 mb-6">
        Generiert automatisch ein BPMN 2.0 Prozessmodell für einzelne Prozessvarianten mittels Gemini.
      </p>

      <div className="mb-6 max-w-2xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-blue-500 text-lg">info</span>
          <p>
            {activeTab === "prozessmodell"
              ? "Bei der Generierung der Prozessgraphen wird KI verwendet."
              : "Die Antworten im Chat werden KI-generiert."}
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

          {bpmnCache[activeIdx] && (
            <div className="mt-6">
              <h2 className="text-xl font-medium mb-3">BPMN 2.0 Prozessmodell — Variante {activeIdx + 1}</h2>
              <div
                ref={containerRef}
                className="w-full border border-gray-200 rounded-lg bg-white overflow-hidden p-4"
                style={{ height: "350px" }}
              />
            </div>
          )}

          {!varianten && (
            <p className="text-gray-500 mt-4">Bitte zuerst eine Datei hochladen.</p>
          )}

          {varianten && (
            <div className="mt-6">
              <h2 className="text-xl font-medium mb-1">Top 10 Prozessvarianten</h2>
              <p className="text-sm text-gray-500 mb-3">
                Generierungen: {generationCount}/{MAX_GENERATIONS}
              </p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Variante</th>
                    <th className="text-right py-2 pr-4">Anzahl</th>
                    <th className="text-right py-2 pr-4">Anteil</th>
                    <th className="text-right py-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {varianten.map((v, i) => {
                    const isActive = activeIdx === i;
                    const isCached = !!bpmnCache[i];
                    const isGenerating = generatingIdx === i;
                    const limitReached = generationCount >= MAX_GENERATIONS && !isCached;

                    return (
                      <tr key={i} className={`border-b border-gray-100 ${isActive ? "bg-blue-50" : ""}`}>
                        <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{v.trace}</td>
                        <td className="py-2 pr-4 text-right">{v.anzahl}</td>
                        <td className="py-2 pr-4 text-right">{v.anteil}%</td>
                        <td className="py-2 text-right">
                          {isActive && isCached ? (
                            <span className="inline-block px-3 py-1 text-xs bg-gray-200 text-gray-500 rounded cursor-default">
                              Angezeigt
                            </span>
                          ) : isCached ? (
                            <button
                              onClick={() => setActiveIdx(i)}
                              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                            >
                              Anzeigen
                            </button>
                          ) : (
                            <button
                              onClick={() => generateForIndex(i, v.trace)}
                              disabled={isGenerating || limitReached}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isGenerating ? "..." : limitReached ? "Limit erreicht" : "Generieren"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "chat" && <ChatTab datenVorhanden={!!varianten} />}
    </div>
  );
}
