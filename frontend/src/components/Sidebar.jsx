import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/upload", label: "Upload", icon: "cloud_upload" },
  { path: "/uebersicht", label: "Übersicht", icon: "home" },
  { path: "/engpassanalyse", label: "Engpassanalyse", icon: "show_chart" },
  { path: "/ki-auswertung", label: "KI-Auswertung", icon: "chat" },
];

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar text-white flex flex-col p-6">
      <div className="flex items-center gap-3 mb-8">
        <img src="/logo.png" alt="ProcessLens AI" className="w-10 h-10 object-contain" />
        <span className="text-lg font-bold">ProcessLens AI</span>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? "bg-primary" : "hover:bg-primary-hover"
              }`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
