from fastapi import APIRouter, File, Form, UploadFile

from Datenvorverarbeitung import datei_einlesen, durchlaufzeit_kpis, engpassanalyse, case_traces_fuer_llm
from bpmn_generator import prozessvarianten, bpmn_fuer_variante_generieren

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
    df = await datei_einlesen(file)
    kpis = durchlaufzeit_kpis(df, case_id, activity, timestamp)
    engpaesse = engpassanalyse(df, case_id, activity, timestamp)
    _last_result = {"filename": file.filename, "kpis": kpis, "engpaesse": engpaesse}
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


@router.get("/kpis")
async def get_kpis():
    if _last_result is None:
        return {"available": False}
    return {"available": True, **_last_result}


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
