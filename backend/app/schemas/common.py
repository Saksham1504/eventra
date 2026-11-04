from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer

from app.utils.time import to_naive_utc


def _ser_dt(d: datetime) -> str:
    return d.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


# Input: any ISO datetime (with or without offset) is stored as naive UTC.
# Output: always an ISO string ending in Z, so the browser converts it to local time correctly.
UtcDatetime = Annotated[
    datetime,
    AfterValidator(to_naive_utc),
    PlainSerializer(_ser_dt, return_type=str, when_used="json"),
]

# Money goes out as a JSON number, not a string.
Money = Annotated[Decimal, PlainSerializer(lambda d: float(d), return_type=float, when_used="json")]
