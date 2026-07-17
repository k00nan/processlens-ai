import io

import pytest
from fastapi.testclient import TestClient
from google.genai.errors import ClientError

import abweichungsanalyse
import bpmn_generator
import chat_generator
import routes
from main import app

client = TestClient(app)

CSV_INHALT = (
    b"case_id,activity,timestamp\n"
    b"1,Start,2020-01-01 08:00:00\n"
    b"1,End,2020-01-01 10:00:00\n"
    b"2,Start,2020-01-02 08:00:00\n"
    b"2,End,2020-01-02 10:00:00\n"
)


def _quota_fehler() -> ClientError:
    """Baut denselben ClientError nach, den das google-genai SDK bei einer
    Kontingent-Überschreitung wirft (real beobachtet: 429 RESOURCE_EXHAUSTED)."""
    return ClientError(
        429,
        {
            "error": {
                "code": 429,
                "message": "You exceeded your current quota, please check your plan and billing details.",
                "status": "RESOURCE_EXHAUSTED",
            }
        },
    )


def _wirft_429_beim_generieren(monkeypatch, ki_client):
    def fake_generate_content(*args, **kwargs):
        raise _quota_fehler()

    monkeypatch.setattr(ki_client.models, "generate_content", fake_generate_content)


@pytest.fixture(autouse=True)
def reset_state():
    """Setzt den globalen Zustand aus routes.py vor jedem Test zurück, da /upload
    Ergebnisse modulweit zwischenspeichert und Tests sich sonst gegenseitig beeinflussen."""
    routes._last_result = None
    routes._last_df = None
    routes._last_columns = None
    routes._varianten = None
    routes._gesamt_anzahl_varianten = None
    yield


def _upload():
    files = {"file": ("log.csv", io.BytesIO(CSV_INHALT), "text/csv")}
    data = {"case_id": "case_id", "activity": "activity", "timestamp": "timestamp"}
    return client.post("/upload", files=files, data=data)


def test_chat_faengt_429_kontingentfehler_von_gemini_sauber_ab(monkeypatch):
    _upload()
    _wirft_429_beim_generieren(monkeypatch, chat_generator.client)

    response = client.post("/chat", json={"frage": "Wie lange dauert der Prozess?", "verlauf": []})
    daten = response.json()

    # Der Server darf nicht mit 500 abstuerzen, sondern muss den Fehler als
    # normale, strukturierte Antwort zurueckgeben.
    assert response.status_code == 200
    assert daten["available"] is False
    assert "429" in daten["error"]
    assert "RESOURCE_EXHAUSTED" in daten["error"]


def test_bpmn_generierung_faengt_429_kontingentfehler_von_gemini_sauber_ab(monkeypatch):
    _wirft_429_beim_generieren(monkeypatch, bpmn_generator.client)

    response = client.post("/bpmn", json={"trace": "Start -> End"})
    daten = response.json()

    assert response.status_code == 200
    assert daten["available"] is False
    assert "429" in daten["error"]
    assert "RESOURCE_EXHAUSTED" in daten["error"]


def test_abweichungsanalyse_faengt_429_kontingentfehler_von_gemini_sauber_ab(monkeypatch):
    _upload()
    _wirft_429_beim_generieren(monkeypatch, abweichungsanalyse.client)

    response = client.post("/abweichungsanalyse")
    daten = response.json()

    assert response.status_code == 200
    assert daten["available"] is False
    assert "429" in daten["error"]
    assert "RESOURCE_EXHAUSTED" in daten["error"]
