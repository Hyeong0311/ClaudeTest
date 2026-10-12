"""시연용 가상 데이터. 테이블이 비어 있을 때 한 번만 넣는다.

실존 인물·회사가 아닌 가상의 이름과 회사만 사용한다.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import APPROVED, PENDING, REJECTED, Visit

KST = ZoneInfo("Asia/Seoul")


def _visit_log(today: date, at: time, stay_minutes: int | None, now: datetime) -> dict:
    """예정 시각 5분 후 입실, stay_minutes 뒤 퇴실한 것처럼 기록. 아직 오지 않은 시각이면 기록하지 않는다."""
    checked_in = datetime.combine(today, at, KST) + timedelta(minutes=5)
    if checked_in > now:
        return {}
    log = {"checked_in_at": checked_in}
    if stay_minutes is not None:
        checked_out = checked_in + timedelta(minutes=stay_minutes)
        if checked_out <= now:
            log["checked_out_at"] = checked_out
    return log


def seed_demo_data(session: Session, today: date) -> None:
    if session.scalar(select(func.count()).select_from(Visit)):
        return

    now = datetime.now(timezone.utc)
    tomorrow = today + timedelta(days=1)
    rows = [
        dict(visitor_name="김민준", company="가온시스템(가상)", visit_date=today, visit_time=time(9, 30),
             purpose="점검·유지보수", host_name="박지훈", status=APPROVED, decided_at=now,
             **_visit_log(today, time(9, 30), 80, now)),
        dict(visitor_name="이서연", company="누리테크(가상)", visit_date=today, visit_time=time(10, 0),
             purpose="업무 협의", host_name="최유진", status=APPROVED, decided_at=now,
             **_visit_log(today, time(10, 0), None, now)),
        dict(visitor_name="정도윤", company="다솜정보(가상)", visit_date=today, visit_time=time(14, 0),
             purpose="납품·설치", host_name="박지훈", status=APPROVED, decided_at=now,
             note="서버 랙 2대 반입"),
        dict(visitor_name="한지우", company="라온데이터(가상)", visit_date=today, visit_time=time(16, 30),
             purpose="업무 협의", host_name="최유진", status=PENDING),
        dict(visitor_name="오하은", company="마루솔루션(가상)", visit_date=tomorrow, visit_time=time(11, 0),
             purpose="면접", host_name="강민서", status=PENDING),
        dict(visitor_name="윤시우", company="바름보안(가상)", visit_date=tomorrow, visit_time=time(15, 0),
             purpose="기타", host_name="강민서", status=REJECTED, decided_at=now,
             reject_reason="담당자 출장으로 일정 변경 요청"),
    ]
    session.add_all(Visit(**row) for row in rows)
    session.commit()
