import { useState, useRef } from "react";

const BACKEND_URL = "http://localhost:8000";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(f) {
    if (!f || !f.name.endsWith(".csv")) {
      return;
    }

    setFile(f);
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", f);

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const { detail } = await response.json();
        throw new Error(detail || "Upload fehlgeschlagen");
      }

      await response.json();
    } catch (err) {
      setError(err.message);
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    handleFile(e.dataTransfer.files[0]);
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

      {uploading && (
        <div className="mt-4 max-w-xl flex items-center gap-2 bg-primary-light text-purple-700 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined">hourglass_top</span>
          <span>Datei wird hochgeladen…</span>
        </div>
      )}

      {!uploading && error && (
        <div className="mt-4 max-w-xl flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {!uploading && !error && file && (
        <div className="mt-4 max-w-xl flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined">check_circle</span>
          <span>Datei erfolgreich geladen: {file.name}</span>
        </div>
      )}
    </div>
  );
}
