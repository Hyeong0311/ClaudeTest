from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

# 신청 상태: 승인 대기 → 승인 / 반려
PENDING = "PENDING"
APPROVED = "APPROVED"
REJECTED = "REJECTED"


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    visitor_name: Mapped[str] = mapped_column(String(50))
    company: Mapped[str] = mapped_column(String(100))
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    visit_time: Mapped[time] = mapped_column(Time)
    purpose: Mapped[str] = mapped_column(String(20))
    host_name: Mapped[str] = mapped_column(String(50))
    note: Mapped[str] = mapped_column(String(200), default="")

    status: Mapped[str] = mapped_column(String(10), default=PENDING, index=True)
    reject_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
