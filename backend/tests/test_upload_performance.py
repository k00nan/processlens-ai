import datetime
import io
import time

import pytest
from fastapi.testclient import TestClient

import routes
from main import app

client = TestClient(app)


def _grosse_csv_erzeugen(anzahl_cases: int = 20_000, events_pro_case: int = 10) -> bytes:
    """Erzeugt synthetisch eine große CSV-Datei in vergleichbarer Größenordnung zu
    echten Event-Logs (~200.000 Zeilen), um eine realistische Performance-Messung
    des Uploads zu ermöglichen, ohne von einer externen (gitignorten) Datei abhängig
    zu sein."""
    aktivitaeten = ["Start", "Check", "Process", "Approve", "End"]
    basis = datetime.datetime(2020, 1, 1)
    zeilen = ["case_id,activity,timestamp"]

    for case in range(anzahl_cases):
        case_start = basis + datetime.timedelta(minutes=case)
        for i in range(events_pro_case):
            zeit = case_start + datetime.timedelta(hours=i)
            aktivitaet = aktivitaeten[i % len(aktivitaeten)]
            zeilen.append(f"{case},{aktivitaet},{zeit.strftime('%Y-%m-%d %H:%M:%S')}")

    return ("\n".join(zeilen) + "\n").encode("utf-8")


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


def test_upload_grosser_datei_ist_innerhalb_von_10_sekunden_abgeschlossen():
    csv_inhalt = _grosse_csv_erzeugen()
    files = {"file": ("grosses_log.csv", io.BytesIO(csv_inhalt), "text/csv")}
    data = {"case_id": "case_id", "activity": "activity", "timestamp": "timestamp"}

    start = time.perf_counter()
    response = client.post("/upload", files=files, data=data)
    dauer = time.perf_counter() - start

    assert response.status_code == 200
    assert response.json()["rows"] == 200_000
    assert dauer < 10.0, f"Upload dauerte {dauer:.2f}s, Grenze sind 10s"
