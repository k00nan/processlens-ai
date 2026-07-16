import asyncio
import io

import pandas as pd
import pytest
from fastapi import HTTPException, UploadFile

from Datenvorverarbeitung import case_traces_fuer_llm, datei_einlesen, durchlaufzeit_kpis, engpassanalyse


def _upload_file(inhalt: bytes, filename: str) -> UploadFile:
    return UploadFile(io.BytesIO(inhalt), filename=filename)


def test_gueltige_csv_wird_als_dataframe_eingelesen():
    inhalt = b"case_id,activity,timestamp\n1,Start,2020-01-01 00:00:00\n1,End,2020-01-02 00:00:00\n"
    file = _upload_file(inhalt, "log.csv")

    df = asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert isinstance(df, pd.DataFrame)
    assert list(df.columns) == ["case_id", "activity", "timestamp"]
    assert len(df) == 2
    assert pd.api.types.is_datetime64_any_dtype(df["timestamp"])


def test_dateiname_ohne_csv_endung_wirft_http_exception():
    file = _upload_file(b"a,b,c\n1,2,2020-01-01 00:00:00\n", "log.txt")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "a", "b", "c"))

    assert exc_info.value.status_code == 400


def test_grossgeschriebene_csv_endung_wird_akzeptiert():
    inhalt = b"case_id,activity,timestamp\n1,Start,2020-01-01 00:00:00\n"
    file = _upload_file(inhalt, "LOG.CSV")

    df = asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert list(df.columns) == ["case_id", "activity", "timestamp"]


def test_defekte_csv_wirft_http_exception():
    inhalt = b'a,b,c\n"1,2\n3,4'
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "a", "b", "c"))

    assert exc_info.value.status_code == 400


def test_fehlende_spalte_wirft_http_exception():
    inhalt = b"case_id,activity\n1,Start\n"
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert exc_info.value.status_code == 400


def test_gleiche_spalte_fuer_mehrere_rollen_wirft_http_exception():
    inhalt = b"case_id,activity,timestamp\n1,Start,2020-01-01 00:00:00\n1,End,2020-01-02 00:00:00\n"
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "timestamp", "activity", "timestamp"))

    assert exc_info.value.status_code == 400


def test_activity_spalte_mit_zahlen_wirft_http_exception():
    inhalt = b"case_id,activity,timestamp\n1,1,2020-01-01 00:00:00\n1,2,2020-01-02 00:00:00\n"
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert exc_info.value.status_code == 400


def test_case_id_spalte_mit_kommazahlen_wirft_http_exception():
    inhalt = b"case_id,activity,timestamp\n1.5,A,2020-01-01 00:00:00\n1.5,B,2020-01-02 00:00:00\n"
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert exc_info.value.status_code == 400


def test_ungueltiger_zeitstempel_wirft_http_exception():
    inhalt = b"case_id,activity,timestamp\n1,A,nicht-ein-datum\n1,B,auch-nicht\n"
    file = _upload_file(inhalt, "log.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert exc_info.value.status_code == 400


def test_gemischte_zeitstempel_formate_werden_vereinheitlicht():
    inhalt = (
        b"case_id,activity,timestamp\n"
        b"1,A,26.01.2018 14:53:12\n"
        b"1,B,2018-01-27 09:05:00\n"
    )
    file = _upload_file(inhalt, "log.csv")

    df = asyncio.run(datei_einlesen(file, "case_id", "activity", "timestamp"))

    assert list(df["timestamp"]) == [
        pd.Timestamp("2018-01-26 14:53:12"),
        pd.Timestamp("2018-01-27 09:05:00"),
    ]


def test_case_traces_werden_nach_zeitstempel_sortiert():
    df = pd.DataFrame({
        "case_id": ["1", "1", "1"],
        "activity": ["Change price", "Start production", "Confirm sale"],
        "timestamp": pd.to_datetime([
            "2017-04-26 10:15:12",
            "2017-04-03 00:00:00",
            "2017-04-20 09:00:00",
        ]),
    })

    result = case_traces_fuer_llm(df, "case_id", "activity", "timestamp")

    assert result == [
        {"case_id": "1", "trace": "Start production -> Confirm sale -> Change price"}
    ]


def test_mehrere_cases_werden_getrennt_aggregiert():
    df = pd.DataFrame({
        "case_id": ["1", "2", "1", "2"],
        "activity": ["Start", "Start", "End", "End"],
        "timestamp": pd.to_datetime([
            "2017-04-03 00:00:00",
            "2017-05-01 00:00:00",
            "2017-04-04 00:00:00",
            "2017-05-02 00:00:00",
        ]),
    })

    result = case_traces_fuer_llm(df, "case_id", "activity", "timestamp")

    assert result == [
        {"case_id": "1", "trace": "Start -> End"},
        {"case_id": "2", "trace": "Start -> End"},
    ]


def test_durchlaufzeit_kpis_berechnet_min_max_durchschnitt_und_median():
    df = pd.DataFrame({
        "case_id": ["1", "1", "1", "2", "2"],
        "activity": ["Start", "Middle", "End", "Start", "End"],
        "timestamp": pd.to_datetime([
            "2020-01-01 00:00:00",
            "2020-01-01 01:00:00",
            "2020-01-01 03:00:00",
            "2020-01-02 00:00:00",
            "2020-01-02 00:10:00",
        ]),
    })

    result = durchlaufzeit_kpis(df, "case_id", "activity", "timestamp")

    assert result["anzahl_cases"] == 2
    assert result["anzahl_events"] == 5
    assert result["anzahl_aktivitaeten"] == 3
    assert result["durchlaufzeit_min_sekunden"] == 600.0
    assert result["durchlaufzeit_max_sekunden"] == 10800.0
    assert result["durchlaufzeit_durchschnitt_sekunden"] == 5700.0
    assert result["durchlaufzeit_median_sekunden"] == 5700.0


def test_durchlaufzeit_kpis_filtert_sentinel_datum():
    df = pd.DataFrame({
        "case_id": ["1", "1", "1"],
        "activity": ["Start", "End", "Fehlerhaft"],
        "timestamp": pd.to_datetime([
            "2020-01-01 00:00:00",
            "2020-01-01 01:00:00",
            "1899-12-30 23:19:32",
        ]),
    })

    result = durchlaufzeit_kpis(df, "case_id", "activity", "timestamp")

    assert result["anzahl_events"] == 2
    assert result["durchlaufzeit_max_sekunden"] == 3600.0


def test_engpassanalyse_berechnet_verweildauer_je_aktivitaet():
    df = pd.DataFrame({
        "case_id": ["1", "1", "1", "2", "2", "2"],
        "activity": ["Start", "Middle", "End", "Start", "Middle", "End"],
        "timestamp": pd.to_datetime([
            "2020-01-01 00:00:00",
            "2020-01-01 00:10:00",
            "2020-01-01 00:40:00",
            "2020-01-02 00:00:00",
            "2020-01-02 00:05:00",
            "2020-01-02 01:05:00",
        ]),
    })

    result = engpassanalyse(df, "case_id", "activity", "timestamp")

    assert [row["aktivitaet"] for row in result] == ["End", "Middle"]

    # End-Dauern (Zeit bis zum Abschluss von End): [1800, 3600]
    end, middle = result
    assert end["durchschnitt_sekunden"] == 2700.0
    assert end["median_sekunden"] == 2700.0
    assert end["maximum_sekunden"] == 3600.0

    # Middle-Dauern (Zeit bis zum Abschluss von Middle): [600, 300]
    assert middle["durchschnitt_sekunden"] == 450.0


def test_engpassanalyse_erste_aktivitaet_je_case_hat_keine_verweildauer():
    df = pd.DataFrame({
        "case_id": ["1", "1"],
        "activity": ["Start", "End"],
        "timestamp": pd.to_datetime(["2020-01-01 00:00:00", "2020-01-01 01:00:00"]),
    })

    result = engpassanalyse(df, "case_id", "activity", "timestamp")

    assert [row["aktivitaet"] for row in result] == ["End"]


def test_engpassanalyse_markiert_bottleneck_instanzen_ueber_iqr_grenze():
    dauern = [100, 100, 100, 100, 100, 100, 100, 500]
    basis = pd.Timestamp("2020-01-01")

    case_ids, aktivitaeten, zeitstempel = [], [], []
    for i, dauer in enumerate(dauern):
        case_id = str(i + 1)
        start_zeit = basis + pd.Timedelta(days=i)
        case_ids += [case_id, case_id]
        aktivitaeten += ["Start", "X"]
        zeitstempel += [start_zeit, start_zeit + pd.Timedelta(seconds=dauer)]

    df = pd.DataFrame({"case_id": case_ids, "activity": aktivitaeten, "timestamp": zeitstempel})

    result = engpassanalyse(df, "case_id", "activity", "timestamp")
    x = next(row for row in result if row["aktivitaet"] == "X")

    # X-Dauern: 7x100s (eng beieinander, IQR=0) + 1x500s -> nur die 500s liegt über
    # der Tukey-Grenze (Q3 + 1,5*IQR = 100 + 0 = 100) dieser Aktivität
    assert x["anzahl_bottlenecks"] == 1
    assert x["anteil_cases_prozent"] == 12.5  # 1 von 8 Cases insgesamt
    assert x["ist_engpass"] is True
