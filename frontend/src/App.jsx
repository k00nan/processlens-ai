import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Upload from "./pages/Upload";
import Uebersicht from "./pages/Uebersicht";
import Prozessanalyse from "./pages/Prozessanalyse";
import KiAuswertung from "./pages/KiAuswertung";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="ml-64 flex-1 p-10">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/uebersicht" element={<Uebersicht />} />
            <Route path="/prozessanalyse" element={<Prozessanalyse />} />
            <Route path="/ki-auswertung" element={<KiAuswertung />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
