import os
from collections import Counter

from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = genai.Client(api_key=os.environ["GEMINI_KEY"])


def prozessvarianten(traces: list[dict], top_n: int = 10) -> list[dict]:
    """Zählt die häufigsten Trace-Varianten und gibt sie sortiert zurück."""
    counter = Counter(t["trace"] for t in traces)
    gesamt = len(traces)
    return [
        {"trace": trace, "anzahl": count, "anteil": round(count / gesamt * 100, 1)}
        for trace, count in counter.most_common(top_n)
    ]


def bpmn_fuer_variante_generieren(trace: str) -> str:
    """Lässt Gemini aus einer einzelnen Prozessvariante ein BPMN 2.0 XML erzeugen."""
    prompt = f"""Du bist ein Business-Process-Modeling-Experte.

Gegeben ist folgende Prozessvariante (Aktivitäten in zeitlicher Reihenfolge):

  {trace}

Erstelle daraus ein vollständiges, valides BPMN 2.0 XML, das genau diesen Prozessablauf abbildet.

Anforderungen:
- Verwende GENAU das BPMN 2.0 XML-Schema (xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL")
- Inkludiere BPMNDiagram mit BPMNPlane und exakte Shape/Edge-Koordinaten (bpmndi), damit das Diagramm direkt renderbar ist
- Ein Start-Event, ein End-Event
- Tasks für jede Aktivität
- Sequence Flows zwischen allen Elementen
- Gib NUR das XML aus, keine Erklärung, kein Markdown-Codeblock

Antworte ausschließlich mit dem BPMN 2.0 XML:"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    bpmn_xml = response.text.strip()
    if bpmn_xml.startswith("```"):
        bpmn_xml = bpmn_xml.split("\n", 1)[1]
        if bpmn_xml.endswith("```"):
            bpmn_xml = bpmn_xml[: bpmn_xml.rfind("```")]
        bpmn_xml = bpmn_xml.strip()

    return bpmn_xml
