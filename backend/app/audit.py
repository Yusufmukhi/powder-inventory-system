from app.database import supabase


def log_activity(
    user: dict,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    details: dict | None = None,
    company_id: str | None = None,
) -> None:
    """
    Best-effort write to the audit trail. This is intentionally fire-and-forget:
    a failure here (network blip, table missing because migration_v7 hasn't
    been run yet, etc.) must never block or fail the real action it's
    describing — losing a log entry is fine, breaking a job approval isn't.

    `company_id` normally comes from the actor (user["company_id"]). Pass it
    explicitly for super_admin actions that target a specific company (e.g.
    creating or suspending it) — a super_admin's own company_id is None, but
    the log entry should still show up in that company's own Activity Log.
    """
    try:
        supabase.table("activity_log").insert({
            "company_id": company_id if company_id is not None else user.get("company_id"),
            "actor_id": user["id"],
            "actor_email": user["email"],
            "actor_username": user.get("username") or (user["email"].split("@")[0] if user.get("email") else None),
            "actor_role": user["role"],
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id is not None else None,
            "details": details or {},
        }).execute()
    except Exception:
        pass
