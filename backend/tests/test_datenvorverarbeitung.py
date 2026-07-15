import pandas as pd
import pytest
from fastapi import HTTPException

from Datenvorverarbeitung import case_traces_fuer_llm

def test_case_traces_werden_nach_zeitstempel_sortiert():
    df = pd.DataFrame({
        "case_id": ["1", "1", "1"],
        "activity": ["Change price", "Start production", "Confirm sale"],
        "timestamp": [
            "2017-04-26 10:15:12",
            "2017-04-03 00:00:00",
            "2017-04-20 09:00:00",
        ],
    })

    result = case_traces_fuer_llm(df, "case_id", "activity", "timestamp")

    assert result == [
        {"case_id": "1", "trace": "Start production -> Confirm sale -> Change price"}
    ]


def test_mehrere_cases_werden_getrennt_aggregiert():
    df = pd.DataFrame({
        "case_id": ["1", "2", "1", "2"],
        "activity": ["Start", "Start", "End", "End"],
        "timestamp": [
            "2017-04-03 00:00:00",
            "2017-05-01 00:00:00",
            "2017-04-04 00:00:00",
            "2017-05-02 00:00:00",
        ],
    })

    result = case_traces_fuer_llm(df, "case_id", "activity", "timestamp")

    assert result == [
        {"case_id": "1", "trace": "Start -> End"},
        {"case_id": "2", "trace": "Start -> End"},
    ]


def test_gemischte_zeitstempel_formate_werden_korrekt_sortiert():
    df = pd.DataFrame({
        "case_id": ["1", "1"],
        "activity": ["B", "A"],
        "timestamp": ["26.01.2018 14:53:12", "2018-01-01 00:00:00"],
    })

    result = case_traces_fuer_llm(df, "case_id", "activity", "timestamp")

    assert result == [{"case_id": "1", "trace": "A -> B"}]


def test_fehlende_spalte_wirft_http_exception():
    df = pd.DataFrame({
        "case_id": ["1"],
        "activity": ["Start"],
        "timestamp": ["2017-04-03 00:00:00"],
    })

    with pytest.raises(HTTPException) as exc_info:
        case_traces_fuer_llm(df, "case_id", "activity", "spalte_die_nicht_existiert")

    assert exc_info.value.status_code == 400
