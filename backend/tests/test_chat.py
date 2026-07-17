import io

import pytest
from fastapi.testclient import TestClient

import routes
from main import app

client = TestClient(app)

CSV_INHALT = (
    b"case_id,activity,timestamp\n"
    b"1,Start,2020-01-01 08:00:00\n"
    b"1,End,2020-01-01 10:00:00\n"
    b"2,Start,2020-01-02 08:00:00\n"
    b"2,End,2020-01-02 12:00:00\n"
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


def test_chat_ohne_upload_nicht_verfuegbar():
    response = client.post("/chat", json={"frage": "Wie lange dauert der Prozess?"})

    assert response.json() == {"available": False, "error": "Bitte zuerst einen Event Log hochladen."}


def test_chat_ohne_frage_gibt_fehler():
    _upload()

    response = client.post("/chat", json={"verlauf": []})

    assert response.json() == {"available": False, "error": "Keine Frage angegeben."}


def test_chat_gibt_antwort_der_llm_funktion_zurueck(monkeypatch):
    _upload()
    monkeypatch.setattr(routes, "frage_beantworten", lambda *a, **kw: "Die Antwort lautet 42.")

    response = client.post("/chat", json={"frage": "Wie lange dauert der Prozess?", "verlauf": []})

    assert response.json() == {"available": True, "antwort": "Die Antwort lautet 42."}


def test_chat_uebergibt_frage_verlauf_kpis_engpaesse_varianten_und_verteilung(monkeypatch):
    _upload()
    aufrufe = []

    def fake_frage_beantworten(frage, verlauf, kpis, engpaesse, varianten, gesamt_anzahl_varianten, verteilung):
        aufrufe.append(
            (frage, verlauf, kpis, engpaesse, varianten, gesamt_anzahl_varianten, verteilung)
        )
        return "ok"

    monkeypatch.setattr(routes, "frage_beantworten", fake_frage_beantworten)

    verlauf = [
        {"rolle": "user", "text": "Vorherige Frage"},
        {"rolle": "assistant", "text": "Vorherige Antwort"},
    ]
    response = client.post("/chat", json={"frage": "Neue Frage", "verlauf": verlauf})

    assert response.json() == {"available": True, "antwort": "ok"}
    assert len(aufrufe) == 1
    frage, verlauf_arg, kpis, engpaesse, varianten, gesamt_anzahl_varianten, verteilung = aufrufe[0]
    assert frage == "Neue Frage"
    assert verlauf_arg == verlauf
    assert kpis["anzahl_cases"] == 2
    assert isinstance(engpaesse, list)
    assert varianten is not None and len(varianten) >= 1
    assert gesamt_anzahl_varianten == len(varianten)
    assert verteilung is not None and "buckets" in verteilung


def test_chat_ohne_verlauf_feld_uebergibt_leere_liste(monkeypatch):
    """`verlauf` ist im Request optional; ohne das Feld soll trotzdem eine leere Liste
    an die LLM-Funktion übergeben werden, statt eines Fehlers."""
    _upload()
    aufrufe = []
    monkeypatch.setattr(
        routes, "frage_beantworten",
        lambda frage, verlauf, *rest: aufrufe.append(verlauf) or "ok",
    )

    response = client.post("/chat", json={"frage": "Frage ohne Verlauf"})

    assert response.json() == {"available": True, "antwort": "ok"}
    assert aufrufe == [[]]


def test_chat_fehler_in_llm_funktion_wird_abgefangen(monkeypatch):
    def fake_frage_beantworten(*a, **kw):
        raise RuntimeError("Gemini nicht erreichbar")

    _upload()
    monkeypatch.setattr(routes, "frage_beantworten", fake_frage_beantworten)

    response = client.post("/chat", json={"frage": "Frage", "verlauf": []})

    assert response.json() == {"available": False, "error": "Gemini nicht erreichbar"}
