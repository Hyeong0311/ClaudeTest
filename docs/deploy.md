# EC2 자동 배포 설정 가이드

`main` 브랜치에 push하면 GitHub Actions가 EC2에 자동으로 배포합니다.

```
push (main)
  └─ GitHub Actions (.github/workflows/deploy.yml)
       ├─ 1. AWS 로그인: OIDC로 IAM 역할을 빌려 씀 (GitHub에 AWS 키 저장 안 함)
       ├─ 2. SSM Run Command: EC2에 명령 전송 (22번 포트 불필요)
       │      └─ EC2: /opt/ClaudeTest 를 이번 커밋으로 맞춤 → scripts/deploy.sh
       │             ├─ Docker / Compose / Buildx 없으면 설치 (최초 1회)
       │             ├─ 메모리 2GB 미만이면 스왑 생성
       │             └─ docker compose up -d --build --wait
       └─ 3. 헬스체크: APP_URL + HEALTH_PATH 가 200인지 확인
```

- 저장소 루트에 `docker-compose.yml`(또는 `compose.yaml`)이 **없으면** 코드만 받아두고 성공으로 끝납니다. 프로젝트를 올리면 그때부터 실행됩니다.
- 빌드가 실패하면 기존 컨테이너는 그대로 유지됩니다 (새 이미지 빌드가 끝나야 교체).

---

## 전제 (이미 되어 있어야 하는 것)

| 항목 | 설정 |
|---|---|
| ALB 리스너 | 80(HTTP), 443(HTTPS, ACM 인증서) |
| ALB 대상 그룹 | **HTTP : 80** → EC2 인스턴스 |
| 대상 그룹 헬스체크 경로 | 프로젝트에서 200을 반환하는 경로 (예: `/` 또는 `/health`) |
| EC2 보안그룹 인바운드 | **80 ← ALB 보안그룹**만 허용. 443은 ALB에서 처리하므로 EC2에는 불필요. 22도 불필요 |
| EC2 아웃바운드 | 전체 허용(기본값). SSM·GitHub·Docker Hub 접속에 필요 |
| EC2 OS | Amazon Linux 2023 |

---

## 1회 설정

### 1. EC2를 Systems Manager에 등록 (SSM용 IAM 역할)

1. **IAM → 역할 → 역할 생성**
   - 신뢰할 수 있는 엔터티: **AWS 서비스 → EC2**
   - 권한 정책: **`AmazonSSMManagedInstanceCore`**
   - 이름: `ec2-ssm-role`
2. **EC2 → 인스턴스 선택 → 작업 → 보안 → IAM 역할 수정** → `ec2-ssm-role` 선택 → 저장
3. 5분 정도 뒤 **Systems Manager → 플릿 관리자(Fleet Manager)** 에서 인스턴스가 **온라인**으로 보이면 완료
   - 10분이 지나도 안 보이면 인스턴스를 **재부팅**

> 이렇게 등록되면 EC2 콘솔 → 연결 → **Session Manager** 탭으로 키 없이 브라우저에서 접속할 수도 있습니다.

### 2. GitHub OIDC 공급자 추가 (AWS 계정당 1회)

**IAM → 자격 증명 공급자 → 공급자 추가**
- 공급자 유형: **OpenID Connect**
- 공급자 URL: `https://token.actions.githubusercontent.com`
- 대상: `sts.amazonaws.com`

이미 목록에 있으면 건너뜁니다.

### 3. GitHub Actions 배포용 IAM 역할

1. **IAM → 역할 → 역할 생성**
   - 신뢰할 수 있는 엔터티: **웹 자격 증명**
   - 자격 증명 공급자: `token.actions.githubusercontent.com` / 대상: `sts.amazonaws.com`
   - GitHub 조직: `Hyeong0311`, 리포지토리: `ClaudeTest`, 브랜치: `main`
   - 권한 단계는 아무것도 선택하지 않고 다음
   - 이름: `github-actions-claudetest-deploy` → 생성
2. 만든 역할 → **신뢰 관계** 탭 → **신뢰 정책 편집**에서 [`infra/iam/github-actions-trust-policy.json`](../infra/iam/github-actions-trust-policy.json) 내용으로 교체 (`<ACCOUNT_ID>`만 바꿈)
   - **콘솔 마법사가 만든 정책은 그대로 쓰면 안 됩니다.** 2026년 7월 15일 이후 만든 GitHub 저장소는 OIDC 토큰의 `sub` 값에 소유자·저장소 **고유 ID**가 붙는 새 형식을 씁니다.
     - 예전 형식: `repo:Hyeong0311/ClaudeTest:ref:refs/heads/main`
     - 이 저장소(새 형식): `repo:Hyeong0311@166098778/ClaudeTest@1413916373:ref:refs/heads/main`
   - ID 확인: `https://api.github.com/repos/<소유자>/<저장소>` 의 `owner.id`, `id`
3. **권한 → 권한 추가 → 인라인 정책 생성 → JSON**
   - [`infra/iam/github-actions-deploy-policy.json`](../infra/iam/github-actions-deploy-policy.json) 내용을 붙여넣고 아래 값 교체
     - `<REGION>` → `ap-northeast-2`
     - `<ACCOUNT_ID>` → 12자리 계정 ID
     - `<INSTANCE_ID>` → `i-...`
   - 정책 이름: `ssm-deploy-claudetest`
4. 역할 상단의 **ARN 복사** (`arn:aws:iam::123456789012:role/github-actions-claudetest-deploy`)

> 이 역할은 **지정한 EC2 한 대에 SSM 명령을 보내는 권한만** 있습니다. `main` 브랜치에서 실행된 워크플로만 사용할 수 있습니다.

### 4. GitHub 저장소 Variables 등록

**GitHub 저장소 → Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**

| 이름 | 값 | 필수 |
|---|---|---|
| `AWS_ROLE_ARN` | 3-4에서 복사한 역할 ARN | 필수 |
| `EC2_INSTANCE_ID` | `i-0123456789abcdef0` | 필수 |
| `APP_URL` | `https://도메인` (끝에 `/` 없이) | 선택 (헬스체크용) |
| `HEALTH_PATH` | `/health` 등 | 선택 (기본 `/`) |
| `AWS_REGION` | `ap-northeast-2` | 선택 (기본값 동일) |

`AWS_ROLE_ARN`, `EC2_INSTANCE_ID`가 등록되기 전에는 배포 작업이 **건너뛰어짐(skipped)** 상태로 표시됩니다.

> 이 저장소는 **공개 저장소**라서 Actions 로그도 누구나 볼 수 있습니다. 계정 ID는 로그에서 가려지지만, 비밀번호 같은 값은 절대 출력되지 않게 하세요.

### 5. 첫 배포 실행

**Actions 탭 → Deploy to EC2 → Run workflow (main)**

- 첫 실행은 Docker 설치 때문에 3~5분 정도 걸립니다.
- compose 파일이 아직 없으면 `compose 파일이 아직 없어 코드 동기화만 하고 종료합니다` 로그와 함께 성공합니다.
- 이후에는 `main`에 push할 때마다 자동으로 실행됩니다.

### 6. (권장) main 브랜치 보호

**Settings → Branches → Add branch ruleset** (또는 Branch protection rule)
- 대상: `main`
- **Require a pull request before merging** 체크

→ `main`에 직접 push하지 못하고 PR 머지로만 배포됩니다. Claude에게 작업을 맡길 때도 브랜치 → PR → 머지(= 배포 승인) 흐름이 됩니다.

---

## 비밀값 (.env)

- EC2의 `/opt/ClaudeTest/.env` 파일은 배포(코드 동기화) 때 **지워지지 않습니다.**
- compose 파일에서 `${DB_PASSWORD}` 처럼 참조하면 이 파일 값이 들어갑니다.
- 작성 방법: EC2 콘솔 → 연결 → Session Manager → 접속 후
  ```bash
  sudo vi /opt/ClaudeTest/.env
  ```
- 저장소에는 `.env`를 커밋하지 않습니다 (`.gitignore`에 포함).

---

## 문제 해결

| 실패한 단계 | 로그 메시지 | 원인 / 조치 |
|---|---|---|
| AWS 로그인 (OIDC) | `Not authorized to perform sts:AssumeRoleWithWebIdentity` | 신뢰 정책의 `sub` 확인. 2026-07-15 이후 만든 저장소는 `repo:소유자@소유자ID/저장소@저장소ID:ref:refs/heads/main` 형식이어야 함. 그 외 저장소명 대소문자, 브랜치, OIDC 공급자의 대상(`sts.amazonaws.com`) 확인 |
| AWS 로그인 (OIDC) | `No OpenIDConnect provider found` | 2단계 OIDC 공급자 누락 |
| EC2에 배포 명령 실행 | `InvalidInstanceId` | EC2가 SSM에 등록되지 않음 → 1단계 확인, 인스턴스 재부팅 |
| EC2에 배포 명령 실행 | `AccessDenied ... ssm:SendCommand` | 인라인 정책의 리전·계정 ID·인스턴스 ID 확인 |
| EC2에 배포 명령 실행 | `EC2 배포 명령 실패` | 같은 단계의 **EC2 출력** 그룹을 펼쳐서 원인 확인 (compose 오류, .env 누락 등) |
| 헬스체크 | `200을 반환하지 않습니다` | ALB 대상 그룹이 healthy인지, EC2 보안그룹(ALB → 80), 헬스체크 경로 확인 |

EC2에서 직접 상태를 보고 싶다면 Session Manager로 접속해서:

```bash
cd /opt/ClaudeTest
sudo docker compose ps
sudo docker compose logs --tail 100
```
