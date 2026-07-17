import json
import os

from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = genai.Client(api_key=os.environ["GEMINI_KEY"])


def soll_ist_abweichung_analysieren(
    varianten: list[dict],
    soll_bpmn_xml: str | None = None,
    soll_trace: str | None = None,
    language: str = "de",
) -> dict:
    """Vergleicht Ist-Prozessvarianten mit einem Sollprozess und liefert strukturierte Texte."""
    if soll_bpmn_xml:
        soll_beschreibung = f"Soll-Prozess (BPMN 2.0 XML):\n{soll_bpmn_xml}"
    else:
        soll_beschreibung = (
            "Soll-Prozess (kein BPMN-Sollprozess hochgeladen - daher wird die häufigste "
            f"tatsächliche Prozessvariante als Referenz angenommen):\n{soll_trace}"
        )

    varianten_text = "\n".join(
        f"{i + 1}. ({v['anteil']}% der Cases, {v['anzahl']} Fälle): {v['trace']}"
        for i, v in enumerate(varianten)
    )
    antwortsprache = "Englisch" if language == "en" else "Deutsch"

    prompt = f"""Du bist ein Process-Mining-Analyst. Vergleiche die tatsächlichen Prozessvarianten
(Ist-Prozess) mit dem vorgegebenen Soll-Prozess.

{soll_beschreibung}

Häufigste (abweichende) Ist-Varianten (Aktivitäten in zeitlicher Reihenfolge):
{varianten_text}

Analysiere für jede Ist-Variante, wie stark und auf welche Weise sie vom Soll-Prozess abweicht
(z.B. fehlende Schritte, zusätzliche Schritte, falsche Reihenfolge, Wiederholungen/Rework).
Fasse anschließend zusammen, welche Abweichungen am häufigsten auftreten und was das für den
Prozess bedeutet.

Antworte AUSSCHLIESSLICH mit validem JSON in genau diesem Format, ohne Markdown-Codeblock:
{{
  "abweichungen": [
    {{"index": 1, "text": "Kurze, konkrete Beschreibung der Abweichung dieser Variante vom Soll-Prozess."}}
  ],
  "zusammenfassung": "Zusammenfassung der häufigsten Abweichungen und was das für den Prozess bedeutet."
}}

Der "index" muss genau der Nummerierung der Ist-Varianten oben entsprechen (ein Eintrag pro
Variante). Antworte auf {antwortsprache}."""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"abweichungen": [], "zusammenfassung": text}
