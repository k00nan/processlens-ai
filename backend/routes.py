from fastapi import APIRouter, File, UploadFile

from Datenvorverarbeitung import datei_einlesen

router = APIRouter()


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    df = await datei_einlesen(file)
    print(df)
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(10).to_dict(orient="records"),
    }
