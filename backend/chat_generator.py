import json
import os

from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = genai.Client(api_key=os.environ["GEMINI_KEY"])


def frage_beantworten(frage: str, verlauf: list[dict], kpis: dict, engpaesse: list[dict]) -> str:
    """Beantwortet eine offene Frage zum Event Log auf Basis der berechneten Auswertungen (KPIs, Engpässe)."""
    verlauf_text = "\n".join(
        f"{'Nutzer' if eintrag['rolle'] == 'user' else 'Assistent'}: {eintrag['text']}"
        for eintrag in verlauf
    )

    prompt = f"""Du bist ein Process-Mining-Analyst und beantwortest Fragen zu einem konkreten Event Log.

Hier sind die berechneten Auswertungen dieses Event Logs:

Durchlaufzeit-KPIs:
{json.dumps(kpis, ensure_ascii=False, indent=2)}

Engpässe je Aktivität (ein Bottleneck liegt vor, wenn eine einzelne Aktivitäts-Instanz mehr als
20% über dem Median genau dieser Aktivität liegt):
{json.dumps(engpaesse, ensure_ascii=False, indent=2)}

Beantworte die Frage des Nutzers ausschließlich auf Basis dieser Daten. Wenn sich die Frage damit
nicht beantworten lässt, sage das ehrlich, anstatt Zahlen zu erfinden. Antworte kurz und konkret,
auf Deutsch.

{f"Bisheriger Chatverlauf:{chr(10)}{verlauf_text}{chr(10)}" if verlauf_text else ""}
Frage: {frage}"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    return response.text.strip()
