from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.dependencies import CurrentUser
from app.database import DbSession
from app.models import Ticket
from app.schemas.booking import TicketOut
from app.services import qr_service
from app.services.serializers import tickets_out

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _owned(db, ticket_id: str, user) -> Ticket:
    t = db.get(Ticket, ticket_id)
    if t is None or (t.user_id != user.id and user.role.value != "ADMIN"):
        raise HTTPException(404, "Ticket not found")
    return t


@router.get("/mine", response_model=list[TicketOut])
def my_tickets(user: CurrentUser, db: DbSession):
    tickets = db.scalars(select(Ticket).where(Ticket.user_id == user.id).order_by(Ticket.issued_at.desc())).all()
    return tickets_out(db, list(tickets))


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, user: CurrentUser, db: DbSession):
    return tickets_out(db, [_owned(db, ticket_id, user)])[0]


@router.get("/{ticket_id}/qr.png")
def ticket_qr(ticket_id: str, user: CurrentUser, db: DbSession):
    ticket = _owned(db, ticket_id, user)
    return Response(content=qr_service.qr_png(qr_service.make_token(ticket.id)), media_type="image/png",
                    headers={"Cache-Control": "private, max-age=3600"})
