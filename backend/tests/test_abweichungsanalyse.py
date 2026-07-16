import io

import pytest
from fastapi.testclient import TestClient

import routes
from main import app

client = TestClient(app)

# 2 Cases mit Variante "Start -> Middle -> End" (haeufigste), 1 Case mit "Start -> End".
CSV_INHALT = (
    b"case_id,activity,timestamp\n"
    b"1,Start,2020-01-01 08:00:00\n"
    b"1,Middle,2020-01-01 09:00:00\n"
    b"1,End,2020-01-01 10:00:00\n"
    b"2,Start,2020-01-02 08:00:00\n"
    b"2,Middle,2020-01-02 09:00:00\n"
    b"2,End,2020-01-02 10:00:00\n"
    b"3,Start,2020-01-03 08:00:00\n"
    b"3,End,2020-01-03 09:00:00\n"
)

BPMN_INHALT = b"""<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1" />
</bpmn:definitions>
"""


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


def test_abweichungsanalyse_ohne_upload_nicht_verfuegbar():
    response = client.post("/abweichungsanalyse")

    assert response.json() == {
        "available": False,
        "error": "Bitte zuerst einen Event Log hochladen.",
    }


def test_abweichungsanalyse_ohne_datei_nutzt_haeufigste_variante_als_soll(monkeypatch):
    _upload()
    aufrufe = []

    def fake_analyse(varianten, soll_bpmn_xml=None, soll_trace=None):
        aufrufe.append((varianten, soll_bpmn_xml, soll_trace))
        return {"abweichungen": [{"index": 1, "text": "Abweichung X"}], "zusammenfassung": "Kurz"}

    monkeypatch.setattr(routes, "soll_ist_abweichung_analysieren", fake_analyse)

    response = client.post("/abweichungsanalyse")
    daten = response.json()

    assert daten["available"] is True
    assert daten["abweichungen"] == [{"index": 1, "text": "Abweichung X"}]
    assert daten["zusammenfassung"] == "Kurz"

    # Die haeufigste Variante (Start -> Middle -> End, 2 Faelle) wird als Referenz
    # genutzt und aus der Vergleichsliste ausgeschlossen -> nur die zweite Variante bleibt.
    varianten, soll_bpmn_xml, soll_trace = aufrufe[0]
    assert soll_bpmn_xml is None
    assert soll_trace == "Start -> Middle -> End"
    assert len(varianten) == 1
    assert varianten[0]["trace"] == "Start -> End"
    assert daten["varianten"] == varianten


def test_abweichungsanalyse_mit_bpmn_datei_nutzt_alle_varianten(monkeypatch):
    _upload()
    aufrufe = []

    def fake_analyse(varianten, soll_bpmn_xml=None, soll_trace=None):
        aufrufe.append((varianten, soll_bpmn_xml, soll_trace))
        return {"abweichungen": [], "zusammenfassung": "Zusammenfassung"}

    monkeypatch.setattr(routes, "soll_ist_abweichung_analysieren", fake_analyse)

    files = {"file": ("soll.bpmn", io.BytesIO(BPMN_INHALT), "text/xml")}
    response = client.post("/abweichungsanalyse", files=files)
    daten = response.json()

    assert daten["available"] is True
    varianten, soll_bpmn_xml, soll_trace = aufrufe[0]
    assert soll_trace is None
    assert soll_bpmn_xml == BPMN_INHALT.decode("utf-8")
    # Mit hochgeladenem Sollprozess werden alle 2 Varianten verglichen (keine wird
    # als Referenz ausgeschlossen).
    assert len(varianten) == 2


def test_abweichungsanalyse_lehnt_falsche_dateiendung_ab():
    _upload()

    files = {"file": ("soll.txt", io.BytesIO(b"kein bpmn"), "text/plain")}
    response = client.post("/abweichungsanalyse", files=files)

    assert response.json() == {
        "available": False,
        "error": "Nur .bpmn-Dateien werden unterstützt.",
    }


def test_abweichungsanalyse_fehler_in_llm_funktion_wird_abgefangen(monkeypatch):
    _upload()

    def fake_analyse(*a, **kw):
        raise RuntimeError("Gemini nicht erreichbar")

    monkeypatch.setattr(routes, "soll_ist_abweichung_analysieren", fake_analyse)

    response = client.post("/abweichungsanalyse")

    assert response.json() == {
        "available": False,
        "error": "Gemini nicht erreichbar",
    }


def test_abweichungsanalyse_fehlende_schluessel_im_ergebnis_werden_mit_defaults_aufgefuellt(monkeypatch):
    """Falls Gemini kein valides JSON liefert, faellt abweichungsanalyse.py auf
    {"abweichungen": [], "zusammenfassung": <rohtext>} zurueck. Der Endpoint muss auch
    ein generell unvollstaendiges Ergebnis-Dict tolerieren, statt mit KeyError abzustuerzen."""
    _upload()
    monkeypatch.setattr(routes, "soll_ist_abweichung_analysieren", lambda *a, **kw: {})

    response = client.post("/abweichungsanalyse")
    daten = response.json()

    assert daten["available"] is True
    assert daten["abweichungen"] == []
    assert daten["zusammenfassung"] == ""
