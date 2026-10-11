# ClaudeTest

Claude Code로 개발하고, `main`에 push하면 AWS EC2에 자동 배포되는 실습 저장소.

## 배포 구조 (수정 요청이 없으면 건드리지 않음)

- `main`에 push → `.github/workflows/deploy.yml` 실행
- GitHub Actions → OIDC로 AWS 로그인 → SSM Run Command → EC2에서 `scripts/deploy.sh`
- EC2 코드 위치: `/opt/ClaudeTest`, 실행: `docker compose up -d --build --wait`
- 배포 대상은 **저장소 루트의 compose 파일**(`docker-compose.yml` 또는 `compose.yaml`). 없으면 실행을 건너뜀.
- 설정 방법과 문제 해결: `docs/deploy.md`
- `.github/workflows/`, `scripts/deploy.sh`, `infra/` 는 배포 파이프라인이므로 요청 없이 수정하지 않는다.

## 인프라 전제

- EC2 1대 (Amazon Linux 2023) 앞에 ALB, Route 53 도메인 연결 완료
- ALB가 80/443을 받고, HTTPS는 ALB에서 종료 → EC2에는 **HTTP 80**으로 전달

## 프로젝트를 추가할 때 지킬 것

- 외부에 여는 포트는 **80번 하나**: `ports: ["80:<컨테이너 포트>"]`. 다른 서비스(백엔드, DB)는 포트를 열지 않고 compose 내부 네트워크로 통신한다.
- ALB 헬스체크 경로가 **HTTP 200**을 반환해야 한다.
- 모든 서비스에 `restart: unless-stopped`.
- DB 데이터는 named volume에 저장한다.
- 1회 실행 후 종료되는 서비스는 두지 않는다 (`--wait` 배포가 실패로 판단함).
- 비밀값은 커밋하지 않는다. EC2의 `/opt/ClaudeTest/.env`에 두고 compose에서 `${변수}`로 참조한다.
- **공개 저장소**이고 Actions 로그도 공개된다. 로그에 비밀값이 출력되지 않게 한다.
- push 전에 `docker compose up --build`로 직접 띄워서 동작을 확인한다.
- 배포된 커밋을 확인하려면 compose에서 `APP_VERSION: ${APP_VERSION}` 을 서비스 환경변수로 넘겨 쓸 수 있다 (deploy.sh가 커밋 SHA를 넣어줌).
