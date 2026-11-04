from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC 'now'. All DATETIME columns in Eventra hold UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt
