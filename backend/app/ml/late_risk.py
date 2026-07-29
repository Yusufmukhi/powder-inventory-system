"""
Late-delivery risk prediction.

A small, explainable logistic regression model trained on this company's own
historical job data (jobs already approved/delivered, where we know whether
they ended up late). Given a *new* job's customer, quantity, and promised lead
time, it estimates the probability the job will be delivered after the
promised date.

This is intentionally simple:
- Only 3 features (lead time, quantity, customer's historical late rate).
- Trained per-company, in-memory, retrained on demand.
- The customer late-rate feature is computed from the same historical set
  it's trained on (a mild form of leakage) — acceptable for a small internal
  tool / student project, but would want a proper train/holdout split by time
  for a production system.
"""

from datetime import date, datetime

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.database import supabase

MIN_TRAINING_JOBS = 20
FEATURES = ["lead_time_days", "qty_received", "customer_late_rate"]

# Per-company trained model + metadata, kept in memory. Small dataset sizes
# for this kind of app make retraining on demand cheap, so we don't bother
# persisting the model to disk.
_model_cache: dict[str, dict] = {}


def _load_training_frame(company_id: str) -> pd.DataFrame:
    jobs = (
        supabase.table("jobs")
        .select("customer_id, qty_received, date_received, date_promised, date_completed, status")
        .eq("company_id", company_id)
        .in_("status", ["approved", "delivered"])
        .execute()
        .data
    )
    rows = [j for j in jobs if j.get("date_completed")]
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["date_received"] = pd.to_datetime(df["date_received"])
    df["date_promised"] = pd.to_datetime(df["date_promised"])
    df["date_completed"] = pd.to_datetime(df["date_completed"])
    df["lead_time_days"] = (df["date_promised"] - df["date_received"]).dt.days
    df["was_late"] = (df["date_completed"] > df["date_promised"]).astype(int)

    customer_late_rate = df.groupby("customer_id")["was_late"].mean()
    df["customer_late_rate"] = df["customer_id"].map(customer_late_rate)

    return df


def train_model(company_id: str) -> dict:
    """Trains (or retrains) the model for one company and caches it in memory."""
    df = _load_training_frame(company_id)
    if len(df) < MIN_TRAINING_JOBS:
        return {
            "trained": False,
            "reason": f"Need at least {MIN_TRAINING_JOBS} completed jobs to train a model "
                      f"(found {len(df)}). Keep approving jobs and try again later.",
            "n_samples": len(df),
        }

    X = df[FEATURES]
    y = df["was_late"]
    can_stratify = y.nunique() > 1

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if can_stratify else None
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 3),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 3),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 3),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 3),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }

    _model_cache[company_id] = {
        "pipeline": pipeline,
        "customer_late_rate": df.groupby("customer_id")["was_late"].mean().to_dict(),
        "overall_late_rate": float(df["was_late"].mean()),
        "trained_at": datetime.utcnow().isoformat(),
        "metrics": metrics,
    }

    return {"trained": True, "metrics": metrics, "n_samples": int(len(df))}


def _get_or_train(company_id: str) -> dict | None:
    if company_id not in _model_cache:
        result = train_model(company_id)
        if not result.get("trained"):
            return None
    return _model_cache.get(company_id)


def predict_late_risk(
    company_id: str,
    customer_id: str,
    qty_received: int,
    date_received: date,
    date_promised: date,
) -> dict:
    cached = _get_or_train(company_id)
    if cached is None:
        return {
            "available": False,
            "reason": "Not enough historical job data yet to predict late risk. "
                      f"Approve at least {MIN_TRAINING_JOBS} jobs first.",
        }

    lead_time_days = (date_promised - date_received).days
    customer_rate = cached["customer_late_rate"].get(customer_id, cached["overall_late_rate"])

    X = pd.DataFrame([{
        "lead_time_days": lead_time_days,
        "qty_received": qty_received,
        "customer_late_rate": customer_rate,
    }])

    proba_late = float(cached["pipeline"].predict_proba(X)[0][1])
    risk_score = round(proba_late * 100, 1)

    if risk_score >= 60:
        risk_label = "high"
    elif risk_score >= 30:
        risk_label = "medium"
    else:
        risk_label = "low"

    return {
        "available": True,
        "risk_score": risk_score,
        "risk_label": risk_label,
        "lead_time_days": lead_time_days,
        "customer_historical_late_rate": round(customer_rate * 100, 1),
        "model_trained_at": cached["trained_at"],
        "model_metrics": cached["metrics"],
    }


def invalidate_cache(company_id: str) -> None:
    """Call after a job is approved so the next prediction retrains on fresh data."""
    _model_cache.pop(company_id, None)
  
