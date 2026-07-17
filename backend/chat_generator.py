import json
import os

from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = genai.Client(api_key=os.environ["GEMINI_KEY"])


def frage_beantworten(
    frage: str,
    verlauf: list[dict],
    kpis: dict,
    engpaesse: list[dict],
    varianten: list[dict] | None = None,
    gesamt_anzahl_varianten: int | None = None,
    verteilung: dict | None = None,
) -> str:
    """Beantwortet eine offene Frage zum Event Log auf Basis der berechneten Auswertungen
    (KPIs, Engpässe, Prozessvarianten, Durchlaufzeit-Verteilung)."""
    verlauf_text = "\n".join(
        f"{'Nutzer' if eintrag['rolle'] == 'user' else 'Assistent'}: {eintrag['text']}"
        for eintrag in verlauf
    )

    varianten_text = (
        "\n".join(
            f"{i + 1}. ({v['anteil']}% der Cases, {v['anzahl']} Fälle): {v['trace']}"
            for i, v in enumerate(varianten)
        )
        if varianten
        else "Keine Prozessvarianten verfügbar."
    )

    gesamt_varianten_text = (
        f"Insgesamt gibt es {gesamt_anzahl_varianten} unterschiedliche Prozessvarianten "
        "(oben stehen nur die häufigsten)."
        if gesamt_anzahl_varianten is not None
        else "Gesamtzahl der Prozessvarianten nicht verfügbar."
    )

    verteilung_text = (
        json.dumps(verteilung, ensure_ascii=False, indent=2)
        if verteilung
        else "Keine Durchlaufzeit-Verteilung verfügbar."
    )

    prompt = f"""Du bist ein Process-Mining-Analyst und beantwortest Fragen zu einem konkreten Event Log.

Hier sind die berechneten Auswertungen dieses Event Logs:

Durchlaufzeit-KPIs:
{json.dumps(kpis, ensure_ascii=False, indent=2)}

Durchlaufzeit-Verteilung (Buckets mit Anzahl Cases je Zeitspanne):
{verteilung_text}

Engpässe je Aktivität (ein Bottleneck liegt vor, wenn eine einzelne Aktivitäts-Instanz die
Ausreißergrenze dieser Aktivität überschreitet: Q3 + 1,5 × Interquartilsabstand, Tukey-Methode):
{json.dumps(engpaesse, ensure_ascii=False, indent=2)}

Häufigste Prozessvarianten (Aktivitäten in zeitlicher Reihenfolge):
{varianten_text}

{gesamt_varianten_text}

Beantworte die Frage des Nutzers ausschließlich auf Basis dieser Daten. Wenn sich die Frage damit
nicht beantworten lässt, sage das ehrlich, anstatt Zahlen zu erfinden. Antworte kurz und konkret,
auf {antwortsprache}.

{f"Bisheriger Chatverlauf:{chr(10)}{verlauf_text}{chr(10)}" if verlauf_text else ""}
Frage: {frage}"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    return response.text.strip()
