import io

import pandas as pd
from fastapi import HTTPException, UploadFile


async def datei_einlesen(file: UploadFile, case_col: str, activity_col: str, timestamp_col: str) -> pd.DataFrame:
    """Liest die vom Frontend hochgeladene CSV-Datei ein und validiert Spalten sowie Zeitstempel."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien werden unterstützt.")

    inhalt = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(inhalt))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Datei konnte nicht gelesen werden: {exc}")

    _spalten_validieren(df, case_col, activity_col, timestamp_col)
    df[timestamp_col] = _zeitstempel_vereinheitlichen(df[timestamp_col], timestamp_col)
    return df


def _zeitstempel_vereinheitlichen(spalte: pd.Series, spaltenname: str) -> pd.Series:
    """Parst eine Zeitstempel-Spalte, die sowohl ISO- (YYYY-MM-DD) als auch
    deutsches Format (DD.MM.YYYY) enthalten kann, ohne die beiden Formate zu verwechseln."""
    spalte = spalte.astype(str).str.strip()
    ist_iso = spalte.str.match(r"^\d{4}-\d{2}-\d{2}")

    ergebnis = pd.Series(pd.NaT, index=spalte.index, dtype="datetime64[ns]")
    try:
        ergebnis.loc[ist_iso] = pd.to_datetime(spalte[ist_iso], format="%Y-%m-%d %H:%M:%S")
        ergebnis.loc[~ist_iso] = pd.to_datetime(spalte[~ist_iso], format="%d.%m.%Y %H:%M:%S")
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail=f"Spalte '{spaltenname}' enthält keine gültigen Zeitstempel.",
        )
    return ergebnis


def _spalten_validieren(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> None:
    """Prüft, dass Case-ID-, Aktivitäts- und Zeitstempel-Spalte vorhanden sind und
    Aktivität sowie Case-ID einen plausiblen Datentyp haben."""
    fehlende_spalten = [col for col in [case_col, activity_col, timestamp_col] if col not in df.columns]
    if fehlende_spalten:
        raise HTTPException(
            status_code=400,
            detail=f"Folgende Spalten wurden nicht in der Datei gefunden: {', '.join(fehlende_spalten)}",
        )

    if len({case_col, activity_col, timestamp_col}) < 3:
        raise HTTPException(
            status_code=400,
            detail="Case-ID, Aktivität und Zeitstempel müssen auf drei unterschiedliche Spalten zeigen.",
        )

    if not pd.api.types.is_string_dtype(df[activity_col]) and not pd.api.types.is_object_dtype(df[activity_col]):
        raise HTTPException(
            status_code=400,
            detail=f"Spalte '{activity_col}' muss Text (Aktivitätsnamen) enthalten, enthält aber Datentyp {df[activity_col].dtype}.",
        )

    if pd.api.types.is_float_dtype(df[case_col]):
        raise HTTPException(
            status_code=400,
            detail=f"Spalte '{case_col}' muss eine Case-ID (Text oder Ganzzahl) enthalten, enthält aber Kommazahlen ({df[case_col].dtype}).",
        )


SENTINEL_DATUM = pd.Timestamp("1899-12-30")  # Excel-Nullwert für leere/fehlerhafte Zeitstempel


def durchlaufzeit_kpis(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> dict:
    """Berechnet Durchlaufzeit-KPIs pro Case."""
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


ENGPASS_SCHWELLENWERT = 1.2  # 20% über dem Median der jeweiligen Aktivität gilt als Bottleneck-Instanz


def engpassanalyse(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> list[dict]:
    """Berechnet je Aktivität die Verweildauer-Statistik sowie Bottlenecks: Eine einzelne
    Aktivitäts-Instanz (in einem Case) gilt als Bottleneck, wenn ihre Dauer mehr als 20%
    über dem Median genau dieser Aktivität liegt."""
    df = df.sort_values([case_col, timestamp_col]).copy()
    df = df[df[timestamp_col].dt.normalize() != SENTINEL_DATUM]

    df["_next_timestamp"] = df.groupby(case_col)[timestamp_col].shift(-1)
    df["_dauer_sekunden"] = (df["_next_timestamp"] - df[timestamp_col]).dt.total_seconds()

    gueltig = df.dropna(subset=["_dauer_sekunden"]).copy()

    aktivitaet_median = gueltig.groupby(activity_col)["_dauer_sekunden"].transform("median")
    gueltig["_ist_bottleneck"] = gueltig["_dauer_sekunden"] > aktivitaet_median * ENGPASS_SCHWELLENWERT

    stats = gueltig.groupby(activity_col)["_dauer_sekunden"].agg(
        durchschnitt="mean", median="median", maximum="max",
    )
    stats["anzahl_bottlenecks"] = gueltig[gueltig["_ist_bottleneck"]].groupby(activity_col).size()
    stats["cases_mit_bottleneck"] = (
        gueltig[gueltig["_ist_bottleneck"]].groupby(activity_col)[case_col].nunique()
    )
    stats = stats.fillna(0)

    gesamt_anzahl_cases = df[case_col].nunique()
    stats["anteil_cases_prozent"] = (stats["cases_mit_bottleneck"] / gesamt_anzahl_cases * 100).round(1)
    stats = stats.sort_values("durchschnitt", ascending=False).reset_index()

    return [
        {
            "aktivitaet": row[activity_col],
            "durchschnitt_sekunden": float(row["durchschnitt"]),
            "median_sekunden": float(row["median"]),
            "maximum_sekunden": float(row["maximum"]),
            "anzahl_bottlenecks": int(row["anzahl_bottlenecks"]),
            "anteil_cases_prozent": float(row["anteil_cases_prozent"]),
            "ist_engpass": bool(row["anzahl_bottlenecks"] > 0),
        }
        for _, row in stats.iterrows()
    ]


def case_traces_fuer_llm(df: pd.DataFrame, case_col: str, activity_col: str, timestamp_col: str) -> list[dict]:
    """Aggregiert die Aktivitäten je Case in zeitlicher Reihenfolge, als Grundlage für die LLM-Verarbeitung."""
    df = df.sort_values([case_col, timestamp_col])

    traces = df.groupby(case_col)[activity_col].apply(lambda a: " -> ".join(a)).reset_index(name="trace")

    return [
        {"case_id": row[case_col], "trace": row["trace"]}
        for _, row in traces.iterrows()
    ]
