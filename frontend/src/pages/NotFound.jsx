import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-6">Seite nicht gefunden.</p>
      <Link
        to="/upload"
        className="bg-primary text-white rounded-lg px-6 py-3 hover:bg-purple-700 transition-colors"
      >
        Zurück zum Upload
      </Link>
    </div>
  );
}
