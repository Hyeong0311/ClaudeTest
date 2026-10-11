# ClaudeTest

Claude Code + GitHub Actions + AWS(EC2 · ALB · Route 53) 자동 배포 실습 저장소.

- `main`에 push하면 EC2에 자동 배포됩니다.
- 저장소 루트에 `docker-compose.yml`을 두면 EC2에서 `docker compose up -d --build`로 실행됩니다.
- 최초 설정 방법과 문제 해결: [docs/deploy.md](docs/deploy.md)

| 경로 | 내용 |
|---|---|
| `.github/workflows/deploy.yml` | 배포 워크플로 (OIDC 로그인 → SSM 명령 → 헬스체크) |
| `scripts/deploy.sh` | EC2에서 실행되는 배포 스크립트 (Docker 자동 설치 포함) |
| `infra/iam/` | AWS IAM 신뢰 정책·권한 정책 |
| `CLAUDE.md` | Claude가 이 저장소에서 작업할 때 따르는 규칙 |
