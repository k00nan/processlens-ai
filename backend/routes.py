from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, Form, Query, UploadFile

from Datenvorverarbeitung import datei_einlesen, durchlaufzeit_kpis, durchlaufzeit_verteilung, engpassanalyse, case_traces_fuer_llm, SENTINEL_DATUM
from bpmn_generator import prozessvarianten, bpmn_fuer_variante_generieren
from chat_generator import frage_beantworten

router = APIRouter()

_last_result: dict | None = None
_last_df = None
_last_columns: dict | None = None
_varianten: list[dict] | None = None


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    activity: str = Form(...),
    timestamp: str = Form(...),
):
    global _last_result, _last_df, _last_columns, _varianten
    df = await datei_einlesen(file, case_id, activity, timestamp)
    kpis = durchlaufzeit_kpis(df, case_id, activity, timestamp)
    engpaesse = engpassanalyse(df, case_id, activity, timestamp)
    verteilung = durchlaufzeit_verteilung(df, case_id, timestamp)
    _last_result = {"filename": file.filename, "kpis": kpis, "engpaesse": engpaesse, "verteilung": verteilung}
    _last_df = df
    _last_columns = {"case_id": case_id, "activity": activity, "timestamp": timestamp}
    _varianten = None
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "kpis": kpis,
        "engpaesse": engpaesse,
    }


def _filter_df(von: Optional[str], bis: Optional[str]) -> pd.DataFrame:
    """Filtert den gespeicherten DataFrame nach Zeitraum (ohne 1899-Sentinel-Daten)."""
    df = _last_df.copy()
    ts_col = _last_columns["timestamp"]
    df = df[df[ts_col].dt.normalize() != SENTINEL_DATUM]
    if von:
        df = df[df[ts_col] >= pd.Timestamp(von)]
    if bis:
        df = df[df[ts_col] <= pd.Timestamp(bis) + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)]
    return df


@router.get("/zeitraum")
async def get_zeitraum():
    if _last_df is None or _last_columns is None:
        return {"available": False}
    ts_col = _last_columns["timestamp"]
    df = _last_df[_last_df[ts_col].dt.normalize() != SENTINEL_DATUM]
    return {
        "available": True,
        "von": str(df[ts_col].min().date()),
        "bis": str(df[ts_col].max().date()),
    }


@router.get("/kpis")
async def get_kpis(von: Optional[str] = Query(None), bis: Optional[str] = Query(None)):
    if _last_result is None:
        return {"available": False}
    if von or bis:
        df = _filter_df(von, bis)
        cols = _last_columns
        kpis = durchlaufzeit_kpis(df, cols["case_id"], cols["activity"], cols["timestamp"])
        verteilung = durchlaufzeit_verteilung(df, cols["case_id"], cols["timestamp"])
        return {"available": True, "filename": _last_result["filename"], "kpis": kpis, "verteilung": verteilung}
    return {"available": True, **_last_result}


@router.get("/durchlaufzeit-verteilung")
async def get_verteilung(von: Optional[str] = Query(None), bis: Optional[str] = Query(None)):
    if _last_result is None or "verteilung" not in _last_result:
        return {"available": False}
    if von or bis:
        df = _filter_df(von, bis)
        cols = _last_columns
        verteilung = durchlaufzeit_verteilung(df, cols["case_id"], cols["timestamp"])
        return {"available": True, "verteilung": verteilung}
    return {"available": True, "verteilung": _last_result["verteilung"]}


@router.get("/engpaesse")
async def get_engpaesse():
    if _last_result is None or "engpaesse" not in _last_result:
        return {"available": False}
    return {"available": True, "engpaesse": _last_result["engpaesse"]}


@router.get("/varianten")
async def get_varianten():
    global _varianten
    if _last_df is None or _last_columns is None:
        return {"available": False}
    if _varianten is None:
        traces = case_traces_fuer_llm(
            _last_df,
            _last_columns["case_id"],
            _last_columns["activity"],
            _last_columns["timestamp"],
        )
        _varianten = prozessvarianten(traces)
    return {"available": True, "varianten": _varianten}


@router.post("/bpmn")
async def generate_bpmn(request: dict):
    trace = request.get("trace")
    if not trace:
        return {"available": False, "error": "Keine Variante angegeben."}
    try:
        bpmn_xml = bpmn_fuer_variante_generieren(trace)
    except Exception as e:
        return {"available": False, "error": str(e)}
    return {"available": True, "bpmn_xml": bpmn_xml}


@router.post("/chat")
async def chat(request: dict):
    if _last_result is None:
        return {"available": False, "error": "Bitte zuerst einen Event Log hochladen."}

    frage = request.get("frage")
    if not frage:
        return {"available": False, "error": "Keine Frage angegeben."}

    verlauf = request.get("verlauf", [])
    try:
        antwort = frage_beantworten(frage, verlauf, _last_result["kpis"], _last_result["engpaesse"])
    except Exception as e:
        return {"available": False, "error": str(e)}
    return {"available": True, "antwort": antwort}
