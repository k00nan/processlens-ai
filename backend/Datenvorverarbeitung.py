import io

import pandas as pd
from fastapi import HTTPException, UploadFile


async def datei_einlesen(file: UploadFile) -> pd.DataFrame:
    """Liest die vom Frontend hochgeladene CSV-Datei in einen DataFrame ein."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien werden unterstützt.")

    inhalt = await file.read()
    try:
        return pd.read_csv(io.BytesIO(inhalt))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Datei konnte nicht gelesen werden: {exc}")
