import uuid


def new_uuid() -> str:
    """IDs are CHAR(36) in the schema, so generate them in the app."""
    return str(uuid.uuid4())
