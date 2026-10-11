#!/usr/bin/env bash
# EC2(Amazon Linux 2023)에서 실행되는 배포 스크립트.
#
# GitHub Actions(.github/workflows/deploy.yml)가 SSM Run Command로 root 권한으로 실행한다.
# 여러 번 실행해도 안전하다(idempotent): 필요한 도구가 없으면 설치하고, 있으면 건너뛴다.
#
#   1. Docker / Docker Compose / Buildx 설치 (최초 1회)
#   2. 메모리가 작으면 스왑 생성 (이미지 빌드 중 메모리 부족 방지)
#   3. 저장소 루트의 compose 파일로 docker compose up -d --build
#      (compose 파일이 아직 없으면 코드 동기화만 하고 종료)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_VERSION="v5.5.1"
BUILDX_VERSION="v0.37.1"
PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"

log() { echo "[deploy $(date '+%H:%M:%S')] $*"; }

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Docker 설치"
    dnf install -y -q docker
  fi
  systemctl enable --now docker >/dev/null 2>&1
  # ec2-user로 접속했을 때도 docker 명령을 쓸 수 있게
  if id ec2-user >/dev/null 2>&1; then
    usermod -aG docker ec2-user
  fi

  local compose_arch buildx_arch
  case "$(uname -m)" in
    x86_64) compose_arch=x86_64; buildx_arch=amd64 ;;
    aarch64) compose_arch=aarch64; buildx_arch=arm64 ;;
    *) log "지원하지 않는 CPU 아키텍처: $(uname -m)"; exit 1 ;;
  esac

  mkdir -p "$PLUGIN_DIR"
  if [ ! -x "$PLUGIN_DIR/docker-compose" ]; then
    log "Docker Compose ${COMPOSE_VERSION} 설치"
    curl -fsSL -o "$PLUGIN_DIR/docker-compose" \
      "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${compose_arch}"
    chmod +x "$PLUGIN_DIR/docker-compose"
  fi
  if [ ! -x "$PLUGIN_DIR/docker-buildx" ]; then
    log "Docker Buildx ${BUILDX_VERSION} 설치"
    curl -fsSL -o "$PLUGIN_DIR/docker-buildx" \
      "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${buildx_arch}"
    chmod +x "$PLUGIN_DIR/docker-buildx"
  fi
}

ensure_swap() {
  local mem_kb
  mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  # 메모리 2GB 미만이고 스왑이 없을 때만 2GB 스왑 생성
  if [ "$mem_kb" -lt 2000000 ] && [ -z "$(swapon --show --noheadings)" ]; then
    log "메모리가 작아 스왑 2GB 생성"
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap defaults 0 0' >> /etc/fstab
  fi
}

find_compose_file() {
  local f
  for f in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f "$APP_DIR/$f" ]; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

main() {
  cd "$APP_DIR"
  log "배포 시작: 커밋 $(git rev-parse --short HEAD) → $APP_DIR"

  install_docker
  ensure_swap

  local compose_file
  if ! compose_file="$(find_compose_file)"; then
    log "compose 파일이 아직 없어 코드 동기화만 하고 종료합니다."
    log "저장소 루트에 docker-compose.yml을 추가하면 다음 배포부터 실행됩니다."
    exit 0
  fi

  if [ ! -f .env ]; then
    log "참고: $APP_DIR/.env 가 없습니다 (비밀값이 필요하면 EC2에서 직접 작성)."
  fi

  # 배포된 커밋 SHA. compose 파일에서 ${APP_VERSION} 으로 참조해 컨테이너에 넘길 수 있다.
  APP_VERSION="$(git rev-parse HEAD)"
  export APP_VERSION

  log "$compose_file 기준으로 이미지 갱신·빌드·실행"
  docker compose -f "$compose_file" pull --ignore-buildable --quiet
  docker compose -f "$compose_file" up -d --build --remove-orphans --wait --wait-timeout 300
  docker image prune -f >/dev/null

  docker compose -f "$compose_file" ps
  log "배포 완료"
}

main "$@"
