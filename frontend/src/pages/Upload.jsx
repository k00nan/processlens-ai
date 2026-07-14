import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = "http://localhost:8000";

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({ caseId: "", activity: "", timestamp: "" });
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function handleFile(f) {
    if (!f || !f.name.endsWith(".csv")) return;

    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      const firstLine = e.target.result.split("\n")[0];
      const headers = firstLine.split(/[,;]/).map((h) => h.trim().replace(/"/g, ""));
      setColumns(headers);
      setMapping({
        caseId: headers.find((h) => /case/i.test(h)) || headers[0] || "",
        activity: headers.find((h) => /activity|aktivit/i.test(h)) || headers[1] || "",
        timestamp: headers.find((h) => /time|datum|date/i.test(h)) || headers[2] || "",
      });
    };
    reader.readAsText(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleAnalyseStarten() {
    if (!file) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", mapping.caseId);
    formData.append("activity", mapping.activity);
    formData.append("timestamp", mapping.timestamp);

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const { detail } = await response.json();
        throw new Error(detail || "Upload fehlgeschlagen");
      }

      const data = await response.json();
      navigate("/uebersicht", { state: { kpis: data.kpis, filename: data.filename } });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Upload</h1>
      <p className="text-gray-600 mb-6">
        Laden Sie Ihren Event Log (CSV) hoch und ordnen Sie die Spalten zu.
      </p>

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        className={`max-w-xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragover
            ? "border-primary bg-primary-light"
            : "border-border-purple bg-surface hover:border-primary hover:bg-primary-light"
        }`}
      >
        <span className="material-symbols-outlined text-5xl text-primary mb-3 block">cloud_upload</span>
        <p className="text-purple-700 mb-4">CSV-Datei hierher ziehen oder klicken</p>
        <button
          onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
          className="bg-primary-light text-purple-700 border border-border-purple rounded-lg px-5 py-2 cursor-pointer hover:bg-primary-hover transition-colors"
        >
          Datei auswählen
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {!uploading && !error && file && (
        <div className="mt-4 max-w-xl flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined">check_circle</span>
          <span>Datei ausgewählt: {file.name}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 max-w-xl flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {columns.length > 0 && (
        <>
          <div className="mt-8 max-w-3xl border border-gray-200 rounded-xl p-6 bg-white">
            <h2 className="text-lg font-semibold mb-1">Spalten zuordnen</h2>
            <p className="text-gray-500 text-sm mb-5">
              Ordnen Sie die Spalten Ihres Event Logs den entsprechenden Feldern zu.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case-ID</label>
                <select
                  value={mapping.caseId}
                  onChange={(e) => setMapping({ ...mapping, caseId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aktivität</label>
                <select
                  value={mapping.activity}
                  onChange={(e) => setMapping({ ...mapping, activity: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zeitstempel</label>
                <select
                  value={mapping.timestamp}
                  onChange={(e) => setMapping({ ...mapping, timestamp: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={handleAnalyseStarten}
                disabled={uploading}
                className="bg-primary text-white font-medium rounded-lg px-8 py-3 hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Wird hochgeladen…" : "Analyse starten"}
              </button>
            </div>
          </div>

          <div className="mt-4 max-w-3xl flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-blue-500">info</span>
            Unterstütztes Format: CSV mit Spalten für Case-ID, Aktivität und Zeitstempel.
          </div>
        </>
      )}
    </div>
  );
}
