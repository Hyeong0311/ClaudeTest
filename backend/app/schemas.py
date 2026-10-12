from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Purpose = Literal["업무 협의", "납품·설치", "점검·유지보수", "면접", "기타"]
Status = Literal["PENDING", "APPROVED", "REJECTED"]


class VisitCreate(BaseModel):
    visitor_name: str = Field(min_length=1, max_length=50)
    company: str = Field(min_length=1, max_length=100)
    visit_date: date
    visit_time: time
    purpose: Purpose
    host_name: str = Field(min_length=1, max_length=50)
    note: str = Field(default="", max_length=200)


class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=200)


class VisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visitor_name: str
    company: str
    visit_date: date
    visit_time: time
    purpose: str
    host_name: str
    note: str
    status: Status
    reject_reason: str | None
    created_at: datetime
    decided_at: datetime | None
    checked_in_at: datetime | None
    checked_out_at: datetime | None


class Summary(BaseModel):
    pending: int  # 승인 대기 (전체)
    expected_today: int  # 오늘 승인됐고 아직 입실 전
    on_site: int  # 입실했고 아직 퇴실 전
    checked_out_today: int  # 오늘 퇴실 완료
