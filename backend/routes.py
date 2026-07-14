from fastapi import APIRouter, File, Form, UploadFile

from Datenvorverarbeitung import datei_einlesen, durchlaufzeit_kpis

router = APIRouter()


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    activity: str = Form(...),
    timestamp: str = Form(...),
):
    df = await datei_einlesen(file)
    kpis = durchlaufzeit_kpis(df, case_id, activity, timestamp)
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "kpis": kpis,
    }
