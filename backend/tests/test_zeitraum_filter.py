import io

import pytest
from fastapi.testclient import TestClient

import routes
from main import app

client = TestClient(app)

CSV_INHALT = (
    b"case_id,activity,timestamp\n"
    b"1,Start,2020-01-01 00:00:00\n"
    b"1,End,2020-01-02 00:00:00\n"
    b"2,Start,2020-02-01 00:00:00\n"
    b"2,End,2020-02-02 00:00:00\n"
    b"3,Start,2020-03-01 00:00:00\n"
    b"3,End,2020-03-02 00:00:00\n"
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


def test_kpis_ohne_upload_nicht_verfuegbar():
    response = client.get("/kpis")

    assert response.json() == {"available": False}


def test_zeitraum_gibt_gesamten_bereich_der_datei_zurueck():
    _upload()

    response = client.get("/zeitraum")
    daten = response.json()

    assert daten["available"] is True
    assert daten["von"] == "2020-01-01"
    assert daten["bis"] == "2020-03-02"


def test_kpis_ohne_filter_enthaelt_alle_cases():
    _upload()

    response = client.get("/kpis")
    daten = response.json()

    assert daten["kpis"]["anzahl_cases"] == 3
    assert daten["kpis"]["anzahl_events"] == 6


def test_kpis_mit_zeitraum_filter_reduziert_auf_passende_cases():
    _upload()

    response = client.get("/kpis", params={"von": "2020-02-01", "bis": "2020-02-28"})
    daten = response.json()

    # Nur Case 2 liegt vollstaendig im Februar; Case 1 (Januar) und Case 3 (Maerz)
    # werden herausgefiltert.
    assert daten["available"] is True
    assert daten["kpis"]["anzahl_cases"] == 1
    assert daten["kpis"]["anzahl_events"] == 2
    assert daten["kpis"]["durchlaufzeit_min_sekunden"] == 86400.0


def test_kpis_mit_nur_von_filtert_ab_datum():
    _upload()

    response = client.get("/kpis", params={"von": "2020-02-01"})
    daten = response.json()

    # Case 1 (Januar) faellt weg, Case 2 und 3 bleiben.
    assert daten["kpis"]["anzahl_cases"] == 2


def test_kpis_mit_nur_bis_filtert_bis_datum():
    _upload()

    response = client.get("/kpis", params={"bis": "2020-01-31"})
    daten = response.json()

    # Nur Case 1 (Januar) bleibt uebrig.
    assert daten["kpis"]["anzahl_cases"] == 1


def test_durchlaufzeit_verteilung_mit_filter_passt_sich_an():
    _upload()

    response = client.get(
        "/durchlaufzeit-verteilung", params={"von": "2020-01-01", "bis": "2020-01-31"}
    )
    daten = response.json()

    assert daten["available"] is True
    assert daten["verteilung"]["durchschnitt_sekunden"] == 86400.0


def test_filter_aendert_die_gespeicherten_gesamtergebnisse_nicht():
    """Das Filtern per Query-Parameter darf den unter /kpis ohne Filter abrufbaren
    Gesamtstand nicht dauerhaft veraendern (kein Seiteneffekt auf den globalen Zustand)."""
    _upload()

    client.get("/kpis", params={"von": "2020-02-01", "bis": "2020-02-28"})

    response = client.get("/kpis")
    daten = response.json()

    assert daten["kpis"]["anzahl_cases"] == 3
