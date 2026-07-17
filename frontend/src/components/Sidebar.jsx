import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const navItems = [
  { path: "/upload", labelKey: "upload", icon: "cloud_upload" },
  { path: "/uebersicht", labelKey: "overview", icon: "home" },
  { path: "/engpassanalyse", labelKey: "bottleneckAnalysis", icon: "show_chart" },
  { path: "/ki-auswertung", labelKey: "aiEvaluation", icon: "chat" },
];

export default function Sidebar() {
  const { t } = useLanguage();

  const linkClassName = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive ? "bg-primary" : "hover:bg-primary-hover"
    }`;

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar text-white flex flex-col p-6">
      <div className="flex items-center gap-3 mb-8">
        <img src="/logo.png" alt="ProcessLens AI" className="w-10 h-10 object-contain" />
        <span className="text-lg font-bold">ProcessLens AI</span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} end className={linkClassName}>
            <span className="material-symbols-outlined">{item.icon}</span>
            {t.nav[item.labelKey]}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/einstellungen"
        className={(state) => `${linkClassName(state)} absolute bottom-6 left-6`}
        aria-label={t.nav.settings}
      >
        <span className="material-symbols-outlined">settings</span>
        {t.nav.settings}
      </NavLink>
    </aside>
  );
}
