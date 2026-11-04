from typing import Literal

from pydantic import BaseModel, Field

from app.models.user import UserRole, VerificationStatus
from app.schemas.common import UtcDatetime


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    type: str | None
    is_read: bool
    created_at: UtcDatetime


class OrganizerApply(BaseModel):
    club_name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class OrganizerProfileOut(BaseModel):
    id: str
    user_id: str
    club_name: str
    description: str | None
    verification_status: VerificationStatus
    created_at: UtcDatetime
    user_name: str | None = None
    user_email: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    college_id: str | None = None


class RoleUpdate(BaseModel):
    role: UserRole


class CollegeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str | None = None


class CollegeOut(BaseModel):
    id: str
    name: str
    location: str | None


class CheckInRequest(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    event_id: str
    gate_name: str | None = Field(default=None, max_length=100)


class CheckInResult(BaseModel):
    result: Literal["ADMITTED", "ALREADY_USED", "CANCELLED", "INVALID", "WRONG_EVENT", "EVENT_NOT_ACTIVE"]
    message: str
    ticket_id: str | None = None
    attendee_name: str | None = None
    ticket_type: str | None = None
    used_at: UtcDatetime | None = None
