export const PURPOSES = ['업무 협의', '납품·설치', '점검·유지보수', '면접', '기타']

// 안내데스크에서 보는 방문 상태 (신청 상태 + 입·퇴실 기록을 합친 것)
export function visitState(visit) {
  if (visit.status !== 'APPROVED') return visit.status
  if (visit.checked_out_at) return 'OUT'
  if (visit.checked_in_at) return 'IN'
  return 'EXPECTED'
}

export const STATE_LABEL = {
  PENDING: '승인 대기',
  REJECTED: '반려',
  APPROVED: '승인',
  EXPECTED: '방문 예정',
  IN: '방문 중',
  OUT: '퇴실',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 'YYYY-MM-DD' → '10월 12일 (월)'
export function formatDate(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return `${m}월 ${d}일 (${WEEKDAYS[day]})`
}

// 'HH:MM:SS' → 'HH:MM'
export const formatTime = (value) => (value ? value.slice(0, 5) : '')

// ISO 시각 → 한국 시간 'HH:MM'
export function formatClock(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
}

export const passNumber = (id) => String(id).padStart(4, '0')

// 한국 시간 기준 오늘 'YYYY-MM-DD'
export const todayKST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
