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


def _zeitstempel_vereinheitlichen(spalte: pd.Series) -> pd.Series:
    """Parst eine Zeitstempel-Spalte, die sowohl ISO- (YYYY-MM-DD) als auch
    deutsches Format (DD.MM.YYYY) enthalten kann, ohne die beiden Formate zu verwechseln."""
    spalte = spalte.astype(str).str.strip()
    ist_iso = spalte.str.match(r"^\d{4}-\d{2}-\d{2}")

    ergebnis = pd.Series(pd.NaT, index=spalte.index, dtype="datetime64[ns]")
    ergebnis.loc[ist_iso] = pd.to_datetime(spalte[ist_iso], format="%Y-%m-%d %H:%M:%S")
    ergebnis.loc[~ist_iso] = pd.to_datetime(spalte[~ist_iso], format="%d.%m.%Y %H:%M:%S")
    return ergebnis


SENTINEL_DATUM = pd.Timestamp("1899-12-30")  # Excel-Nullwert für leere/fehlerhafte Zeitstempel


def durchlaufzeit_kpis(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> dict:
    """Berechnet Durchlaufzeit-KPIs pro Case."""
    for col in [case_col, activity_col, timestamp_col]:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Spalte '{col}' nicht in der Datei gefunden.")

    df[timestamp_col] = _zeitstempel_vereinheitlichen(df[timestamp_col])
    df = df[df[timestamp_col].dt.normalize() != SENTINEL_DATUM]

    case_durations = df.groupby(case_col)[timestamp_col].agg(["min", "max"])
    case_durations["duration"] = case_durations["max"] - case_durations["min"]

    durations_seconds = case_durations["duration"].dt.total_seconds()

    anzahl_cases = len(case_durations)
    anzahl_events = len(df)
    anzahl_aktivitaeten = df[activity_col].nunique()

    return {
        "anzahl_cases": anzahl_cases,
        "anzahl_events": anzahl_events,
        "anzahl_aktivitaeten": anzahl_aktivitaeten,
        "durchlaufzeit_min_sekunden": float(durations_seconds.min()),
        "durchlaufzeit_max_sekunden": float(durations_seconds.max()),
        "durchlaufzeit_durchschnitt_sekunden": float(durations_seconds.mean()),
        "durchlaufzeit_median_sekunden": float(durations_seconds.median()),
    }


def engpassanalyse(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> list[dict]:
    """Berechnet die durchschnittliche Verweildauer pro Aktivität (Activity-Level Bottlenecks)."""
    df = df.sort_values([case_col, timestamp_col]).copy()
    df[timestamp_col] = _zeitstempel_vereinheitlichen(df[timestamp_col])
    df = df[df[timestamp_col].dt.normalize() != SENTINEL_DATUM]

    df["_next_timestamp"] = df.groupby(case_col)[timestamp_col].shift(-1)
    df["_dauer_sekunden"] = (df["_next_timestamp"] - df[timestamp_col]).dt.total_seconds()

    stats = (
        df.dropna(subset=["_dauer_sekunden"])
        .groupby(activity_col)["_dauer_sekunden"]
        .agg(["mean", "median", "max", "count"])
        .rename(columns={"mean": "durchschnitt", "median": "median", "max": "maximum", "count": "anzahl"})
        .sort_values("durchschnitt", ascending=False)
        .reset_index()
    )

    return [
        {
            "aktivitaet": row[activity_col],
            "durchschnitt_sekunden": float(row["durchschnitt"]),
            "median_sekunden": float(row["median"]),
            "maximum_sekunden": float(row["maximum"]),
            "anzahl": int(row["anzahl"]),
        }
        for _, row in stats.iterrows()
    ]


def case_traces_fuer_llm(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> list[dict]:
    """Aggregiert die Aktivitäten je Case in zeitlicher Reihenfolge, als Grundlage für die LLM-Verarbeitung."""
    for col in [case_col, activity_col, timestamp_col]:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Spalte '{col}' nicht in der Datei gefunden.")

    df = df.copy()
    df[timestamp_col] = _zeitstempel_vereinheitlichen(df[timestamp_col])
    df = df.sort_values([case_col, timestamp_col])

    traces = df.groupby(case_col)[activity_col].apply(lambda a: " -> ".join(a)).reset_index(name="trace")

    return [
        {"case_id": row[case_col], "trace": row["trace"]}
        for _, row in traces.iterrows()
    ]
