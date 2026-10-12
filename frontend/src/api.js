// 백엔드 API 호출 모음. 모든 요청은 같은 도메인의 /api 로 보낸다.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let message = `요청을 처리하지 못했습니다 (${res.status}).`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = '입력값을 다시 확인해 주세요.'
    } catch {
      // 본문이 JSON이 아니면 기본 메시지 사용
    }
    const error = new Error(message)
    error.status = res.status
    throw error
  }
  return res.json()
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

export const createVisit = (visit) => post('/visits', visit)
export const getVisit = (id) => request(`/visits/${id}`)
export const listVisits = (status) => request(`/visits${status ? `?status=${status}` : ''}`)
export const listToday = () => request('/visits/today')
export const getSummary = () => request('/visits/summary')
export const approveVisit = (id) => post(`/visits/${id}/approve`)
export const rejectVisit = (id, reason) => post(`/visits/${id}/reject`, { reason })
export const checkIn = (id) => post(`/visits/${id}/check-in`)
export const checkOut = (id) => post(`/visits/${id}/check-out`)
export const getVersion = () => request('/version')
