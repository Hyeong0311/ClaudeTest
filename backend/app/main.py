import os
import time as systime
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy import and_, func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, get_session
from .models import APPROVED, PENDING, REJECTED, Visit
from .schemas import RejectIn, Status, Summary, VisitCreate, VisitOut
from .seed import seed_demo_data

KST = ZoneInfo("Asia/Seoul")
# 배포 스크립트가 넣어주는 git 커밋 SHA. 배포 반영 여부 확인용.
APP_VERSION = os.getenv("APP_VERSION", "dev")


def today_kst() -> date:
    return datetime.now(KST).date()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def init_db() -> None:
    # DB 컨테이너가 막 뜬 직후일 수 있어 몇 번 재시도한다.
    for attempt in range(10):
        try:
            Base.metadata.create_all(engine)
            break
        except OperationalError:
            if attempt == 9:
                raise
            systime.sleep(2)
    if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
        with SessionLocal() as session:
            seed_demo_data(session, today_kst())


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="방문 출입 관리 API",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


def get_visit_or_404(session: Session, visit_id: int) -> Visit:
    visit = session.get(Visit, visit_id)
    if visit is None:
        raise HTTPException(status_code=404, detail=f"접수번호 {visit_id}번 신청을 찾을 수 없습니다.")
    return visit


def save(session: Session, visit: Visit) -> Visit:
    session.commit()
    session.refresh(visit)
    return visit


# ---- 상태 확인 ----


@app.get("/api/health")
def health(session: Session = Depends(get_session)):
    try:
        session.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc.__class__.__name__}")
    return {"status": "ok"}


@app.get("/api/version")
def version():
    return {"version": APP_VERSION}


# ---- 방문 신청 (방문자) ----


@app.post("/api/visits", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def create_visit(payload: VisitCreate, session: Session = Depends(get_session)):
    if payload.visit_date < today_kst():
        raise HTTPException(status_code=422, detail="방문일은 오늘 이후 날짜로 선택해 주세요.")
    data = payload.model_dump()
    data["visitor_name"] = data["visitor_name"].strip()
    data["company"] = data["company"].strip()
    data["host_name"] = data["host_name"].strip()
    data["note"] = data["note"].strip()
    visit = Visit(**data, status=PENDING)
    session.add(visit)
    return save(session, visit)


# ---- 안내데스크 (관리자) ----


@app.get("/api/visits", response_model=list[VisitOut])
def list_visits(
    status_filter: Status | None = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
):
    query = select(Visit)
    if status_filter:
        query = query.where(Visit.status == status_filter)
    if status_filter == PENDING:
        # 승인 대기는 방문일이 가까운 순서로 처리
        query = query.order_by(Visit.visit_date, Visit.visit_time, Visit.id)
    else:
        query = query.order_by(Visit.visit_date.desc(), Visit.visit_time.desc(), Visit.id.desc())
    return session.scalars(query.limit(200)).all()


@app.get("/api/visits/today", response_model=list[VisitOut])
def list_today(session: Session = Depends(get_session)):
    query = (
        select(Visit)
        .where(Visit.visit_date == today_kst(), Visit.status == APPROVED)
        .order_by(Visit.visit_time, Visit.id)
    )
    return session.scalars(query).all()


@app.get("/api/visits/summary", response_model=Summary)
def summary(session: Session = Depends(get_session)):
    today = today_kst()
    approved_today = and_(Visit.visit_date == today, Visit.status == APPROVED)

    def count(*conditions) -> int:
        return session.scalar(select(func.count()).select_from(Visit).where(*conditions)) or 0

    return Summary(
        pending=count(Visit.status == PENDING),
        expected_today=count(approved_today, Visit.checked_in_at.is_(None)),
        on_site=count(Visit.checked_in_at.is_not(None), Visit.checked_out_at.is_(None)),
        checked_out_today=count(approved_today, Visit.checked_out_at.is_not(None)),
    )


@app.get("/api/visits/{visit_id}", response_model=VisitOut)
def get_visit(visit_id: int, session: Session = Depends(get_session)):
    return get_visit_or_404(session, visit_id)


@app.post("/api/visits/{visit_id}/approve", response_model=VisitOut)
def approve(visit_id: int, session: Session = Depends(get_session)):
    visit = get_visit_or_404(session, visit_id)
    if visit.status != PENDING:
        raise HTTPException(status_code=409, detail="승인 대기 중인 신청만 승인할 수 있습니다.")
    visit.status = APPROVED
    visit.decided_at = now_utc()
    return save(session, visit)


@app.post("/api/visits/{visit_id}/reject", response_model=VisitOut)
def reject(visit_id: int, payload: RejectIn, session: Session = Depends(get_session)):
    visit = get_visit_or_404(session, visit_id)
    if visit.status != PENDING:
        raise HTTPException(status_code=409, detail="승인 대기 중인 신청만 반려할 수 있습니다.")
    visit.status = REJECTED
    visit.reject_reason = payload.reason.strip() or None
    visit.decided_at = now_utc()
    return save(session, visit)


@app.post("/api/visits/{visit_id}/check-in", response_model=VisitOut)
def check_in(visit_id: int, session: Session = Depends(get_session)):
    visit = get_visit_or_404(session, visit_id)
    if visit.status != APPROVED:
        raise HTTPException(status_code=409, detail="승인된 방문만 입실 처리할 수 있습니다.")
    if visit.visit_date != today_kst():
        raise HTTPException(status_code=409, detail="방문일이 오늘인 경우에만 입실 처리할 수 있습니다.")
    if visit.checked_in_at is not None:
        raise HTTPException(status_code=409, detail="이미 입실 처리된 방문입니다.")
    visit.checked_in_at = now_utc()
    return save(session, visit)


@app.post("/api/visits/{visit_id}/check-out", response_model=VisitOut)
def check_out(visit_id: int, session: Session = Depends(get_session)):
    visit = get_visit_or_404(session, visit_id)
    if visit.checked_in_at is None:
        raise HTTPException(status_code=409, detail="입실 처리 후에 퇴실할 수 있습니다.")
    if visit.checked_out_at is not None:
        raise HTTPException(status_code=409, detail="이미 퇴실 처리된 방문입니다.")
    visit.checked_out_at = now_utc()
    return save(session, visit)
