from fastapi import APIRouter, File, Form, UploadFile

from Datenvorverarbeitung import datei_einlesen, durchlaufzeit_kpis, engpassanalyse

router = APIRouter()

_last_result: dict | None = None


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    activity: str = Form(...),
    timestamp: str = Form(...),
):
    global _last_result
    df = await datei_einlesen(file, case_id, activity, timestamp)
    kpis = durchlaufzeit_kpis(df, case_id, activity, timestamp)
    engpaesse = engpassanalyse(df, case_id, activity, timestamp)
    _last_result = {"filename": file.filename, "kpis": kpis, "engpaesse": engpaesse}
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
