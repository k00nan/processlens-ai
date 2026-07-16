import { useState, useRef, useEffect } from "react";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";

const MAX_GENERATIONS = 3;

export default function KiAuswertung() {
  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [error, setError] = useState(null);
  const [varianten, setVarianten] = useState(null);
  const [bpmnCache, setBpmnCache] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [generationCount, setGenerationCount] = useState(0);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8000/varianten")
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
      const res = await fetch("http://localhost:8000/bpmn", {
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

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">KI-Auswertung</h1>
      <p className="text-gray-600 mb-6">
        Generiert automatisch ein BPMN 2.0 Prozessmodell für einzelne Prozessvarianten mittels Gemini.
      </p>

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
    </div>
  );
}
