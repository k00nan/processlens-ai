import io
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import bpmn_generator
import routes
from bpmn_generator import prozessvarianten, gesamt_anzahl_varianten
from main import app

client = TestClient(app)

CSV_INHALT = (
    b"case_id,activity,timestamp\n"
    # 3 Cases mit Variante "A -> B" (60%)
    b"1,A,2020-01-01 08:00:00\n1,B,2020-01-01 09:00:00\n"
    b"2,A,2020-01-02 08:00:00\n2,B,2020-01-02 09:00:00\n"
    b"3,A,2020-01-03 08:00:00\n3,B,2020-01-03 09:00:00\n"
    # 2 Cases mit Variante "A -> C" (40%)
    b"4,A,2020-01-04 08:00:00\n4,C,2020-01-04 09:00:00\n"
    b"5,A,2020-01-05 08:00:00\n5,C,2020-01-05 09:00:00\n"
)


@pytest.fixture(autouse=True)
def reset_state():
    """Setzt den globalen Zustand aus routes.py vor jedem Test zurück, da /upload
    Ergebnisse modulweit zwischenspeichert und Tests sich sonst gegenseitig beeinflussen."""
    routes._last_result = None
    routes._last_df = None
    routes._last_columns = None
    routes._varianten = None
    yield


def _upload():
    files = {"file": ("log.csv", io.BytesIO(CSV_INHALT), "text/csv")}
    data = {"case_id": "case_id", "activity": "activity", "timestamp": "timestamp"}
    return client.post("/upload", files=files, data=data)


# --- prozessvarianten() (reine Funktion, kein LLM) -----------------------------------


def test_prozessvarianten_zaehlt_und_sortiert_nach_haeufigkeit():
    traces = [
        {"trace": "A -> B"}, {"trace": "A -> B"}, {"trace": "A -> B"},
        {"trace": "A -> C"}, {"trace": "A -> C"},
    ]

    result = prozessvarianten(traces)

    assert result == [
        {"trace": "A -> B", "anzahl": 3, "anteil": 60.0},
        {"trace": "A -> C", "anzahl": 2, "anteil": 40.0},
    ]


def test_prozessvarianten_rundet_anteil_auf_eine_nachkommastelle():
    traces = [{"trace": "A"}, {"trace": "A"}, {"trace": "B"}]

    result = prozessvarianten(traces)

    anteil_a = next(v["anteil"] for v in result if v["trace"] == "A")
    assert anteil_a == round(2 / 3 * 100, 1)


def test_prozessvarianten_begrenzt_auf_top_n():
    traces = [{"trace": f"Variante {i}"} for i in range(15)]

    result = prozessvarianten(traces, top_n=5)

    assert len(result) == 5


def test_prozessvarianten_top_n_default_ist_zehn():
    traces = [{"trace": f"Variante {i}"} for i in range(15)]

    result = prozessvarianten(traces)

    assert len(result) == 10


# --- gesamt_anzahl_varianten() (reine Funktion, kein LLM) ----------------------------


def test_gesamt_anzahl_varianten_zaehlt_unterschiedliche_traces():
    traces = [
        {"trace": "A -> B"}, {"trace": "A -> B"}, {"trace": "A -> B"},
        {"trace": "A -> C"}, {"trace": "A -> C"},
    ]

    assert gesamt_anzahl_varianten(traces) == 2


def test_gesamt_anzahl_varianten_ist_unabhaengig_von_top_n_begrenzung():
    """Im Gegensatz zu prozessvarianten() (auf top_n begrenzt) muss
    gesamt_anzahl_varianten() alle Varianten zaehlen, nicht nur die Top 10."""
    traces = [{"trace": f"Variante {i}"} for i in range(15)]

    assert gesamt_anzahl_varianten(traces) == 15


# --- /varianten Endpoint (End-to-End, ohne Mocking noetig) ---------------------------


def test_varianten_endpoint_ohne_upload_nicht_verfuegbar():
    response = client.get("/varianten")

    assert response.json() == {"available": False}


def test_varianten_endpoint_liefert_korrekt_gezaehlte_varianten():
    _upload()

    response = client.get("/varianten")
    daten = response.json()

    assert daten["available"] is True
    assert daten["varianten"] == [
        {"trace": "A -> B", "anzahl": 3, "anteil": 60.0},
        {"trace": "A -> C", "anzahl": 2, "anteil": 40.0},
    ]
    assert daten["gesamt_anzahl_varianten"] == 2


# --- bpmn_fuer_variante_generieren() (mit gemocktem LLM-Call) ------------------------


def _mock_gemini(monkeypatch, text):
    aufrufe = []

    def fake_generate_content(model, contents):
        aufrufe.append((model, contents))
        return SimpleNamespace(text=text)

    monkeypatch.setattr(bpmn_generator.client.models, "generate_content", fake_generate_content)
    return aufrufe


def test_bpmn_generieren_gibt_xml_unveraendert_zurueck_ohne_codeblock(monkeypatch):
    _mock_gemini(monkeypatch, "<bpmn:definitions>...</bpmn:definitions>")

    ergebnis = bpmn_generator.bpmn_fuer_variante_generieren("Start -> End")

    assert ergebnis == "<bpmn:definitions>...</bpmn:definitions>"


def test_bpmn_generieren_entfernt_markdown_codeblock(monkeypatch):
    roh = "```xml\n<bpmn:definitions>...</bpmn:definitions>\n```"
    _mock_gemini(monkeypatch, roh)

    ergebnis = bpmn_generator.bpmn_fuer_variante_generieren("Start -> End")

    assert ergebnis == "<bpmn:definitions>...</bpmn:definitions>"


def test_bpmn_generieren_uebergibt_trace_im_prompt(monkeypatch):
    aufrufe = _mock_gemini(monkeypatch, "<bpmn:definitions />")

    bpmn_generator.bpmn_fuer_variante_generieren("Start -> Middle -> End")

    _, prompt = aufrufe[0]
    assert "Start -> Middle -> End" in prompt


# --- /bpmn Endpoint (gemockt) ---------------------------------------------------------


def test_bpmn_endpoint_ohne_trace_gibt_fehler():
    response = client.post("/bpmn", json={})

    assert response.json() == {"available": False, "error": "Keine Variante angegeben."}


def test_bpmn_endpoint_gibt_generiertes_xml_zurueck(monkeypatch):
    monkeypatch.setattr(routes, "bpmn_fuer_variante_generieren", lambda trace: f"<xml für {trace}>")

    response = client.post("/bpmn", json={"trace": "Start -> End"})

    assert response.json() == {"available": True, "bpmn_xml": "<xml für Start -> End>"}


def test_bpmn_endpoint_fehler_in_llm_funktion_wird_abgefangen(monkeypatch):
    def fake_generieren(trace):
        raise RuntimeError("Gemini nicht erreichbar")

    monkeypatch.setattr(routes, "bpmn_fuer_variante_generieren", fake_generieren)

    response = client.post("/bpmn", json={"trace": "Start -> End"})

    assert response.json() == {"available": False, "error": "Gemini nicht erreichbar"}
