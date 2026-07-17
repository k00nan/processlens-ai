import { useLanguage } from "../context/LanguageContext";

const languageOptions = [
  { value: "de", labelKey: "german" },
  { value: "en", labelKey: "english" },
];

export default function Einstellungen() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">{t.settings.title}</h1>
      <p className="text-gray-600 mb-8">{t.settings.description}</p>

      <section className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <span className="material-symbols-outlined text-primary mt-0.5">language</span>
          <div>
            <h2 className="text-lg font-semibold">{t.settings.languageTitle}</h2>
            <p className="text-sm text-gray-500">{t.settings.languageDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {languageOptions.map((option) => {
            const isSelected = language === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLanguage(option.value)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary-light text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-border-purple hover:bg-primary-light"
                }`}
              >
                <span className="font-medium">{t.settings[option.labelKey]}</span>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          {t.settings.german}: {t.settings.defaultBadge}
        </div>
      </section>
    </div>
  );
}
