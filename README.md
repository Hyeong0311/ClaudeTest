# ClaudeTest — 방문 출입 관리 프로토타입

Claude Code + GitHub Actions + AWS(EC2 · ALB · Route 53) 자동 배포 실습 저장소입니다.
`main`에 push하면 EC2에 자동 배포됩니다.

## 화면

| 주소 | 화면 | 하는 일 |
|---|---|---|
| `/` | 방문 신청 | 방문자가 신청서를 작성하면 방문증 미리보기가 함께 채워지고, 신청 후 접수번호 발급 |
| `/status` | 신청 조회 | 접수번호로 승인 대기 · 승인 · 반려 · 입실 · 퇴실 상태 확인 |
| `/desk` | 안내데스크 | 오늘 방문자 입실·퇴실 처리, 승인 대기 신청 승인·반려, 전체 신청 조회 |

데이터는 모두 시연용 가상 데이터이며, 처음 실행할 때 예시 신청 6건이 자동으로 들어갑니다.
1차 프로토타입이라 로그인·권한은 아직 없습니다.

## 구성

```
ALB (80/443) ──> EC2 :80
                  └─ docker compose
                       ├─ frontend : nginx (React 빌드 결과 서빙, /api → backend 전달)
                       ├─ backend  : FastAPI (Python)
                       └─ db       : PostgreSQL 16 (외부 포트 없음, named volume)
```

| 경로 | 내용 |
|---|---|
| `frontend/` | React + Vite, nginx 설정 |
| `backend/` | FastAPI API, SQLAlchemy 모델, 시연 데이터 |
| `docker-compose.yml` | 세 서비스를 묶는 설정 (배포 대상) |
| `.github/workflows/deploy.yml` | 배포 워크플로 (OIDC 로그인 → SSM 명령 → 헬스체크) |
| `scripts/deploy.sh` | EC2에서 실행되는 배포 스크립트 |
| `infra/iam/` | AWS IAM 신뢰 정책 · 권한 정책 |
| `docs/deploy.md` | 최초 설정 방법과 문제 해결 |

## 로컬 실행

```bash
docker compose up --build
# http://localhost  (API 문서: http://localhost/api/docs)
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/visits` | 방문 신청 |
| GET | `/api/visits/{id}` | 신청 조회 |
| GET | `/api/visits?status=PENDING` | 신청 목록 (상태 필터) |
| GET | `/api/visits/today` | 오늘 승인된 방문 |
| GET | `/api/visits/summary` | 승인 대기 · 오늘 예정 · 방문 중 · 오늘 퇴실 건수 |
| POST | `/api/visits/{id}/approve` · `/reject` | 승인 · 반려 |
| POST | `/api/visits/{id}/check-in` · `/check-out` | 입실 · 퇴실 |
| GET | `/api/health` · `/api/version` | 상태 확인 · 배포된 커밋 |
