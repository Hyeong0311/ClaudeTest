import { useCallback, useEffect, useState } from 'react'
import {
  approveVisit,
  checkIn,
  checkOut,
  getSummary,
  listToday,
  listVisits,
  rejectVisit,
} from '../api.js'
import { STATE_LABEL, formatClock, formatDate, formatTime, passNumber, visitState } from '../labels.js'

const TABS = [
  { id: 'today', label: '오늘 방문' },
  { id: 'pending', label: '승인 대기' },
  { id: 'all', label: '전체 신청' },
]

const ALL_FILTERS = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '승인 대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '반려' },
]

const REFRESH_MS = 20000

function StateTag({ visit }) {
  const state = visitState(visit)
  return <span className={`tag tag-${state.toLowerCase()}`}>{STATE_LABEL[state]}</span>
}

function Visitor({ visit }) {
  return (
    <div className="who">
      <span className="who-name">{visit.visitor_name}</span>
      <span className="who-company">{visit.company}</span>
    </div>
  )
}

export default function DeskPage() {
  const [tab, setTab] = useState('today')
  const [allFilter, setAllFilter] = useState('')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null) // { id, reason }
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    try {
      const fetchRows =
        tab === 'today' ? listToday() : tab === 'pending' ? listVisits('PENDING') : listVisits(allFilter)
      const [s, r] = await Promise.all([getSummary(), fetchRows])
      setSummary(s)
      setRows(r)
      setError('')
      setUpdatedAt(new Date())
    } catch (err) {
      setError(`목록을 불러오지 못했습니다. ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [tab, allFilter])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  async function act(id, action) {
    setBusyId(id)
    try {
      await action()
      setRejecting(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const counts = [
    { label: '승인 대기', value: summary?.pending },
    { label: '오늘 방문 예정', value: summary?.expected_today },
    { label: '방문 중', value: summary?.on_site },
    { label: '오늘 퇴실', value: summary?.checked_out_today },
  ]

  return (
    <div className="desk">
      <div className="desk-head">
        <div>
          <h1 className="page-title">안내데스크</h1>
          <p className="lead">오늘 방문자의 입실·퇴실을 기록하고 방문 신청을 승인합니다.</p>
        </div>
        <button type="button" className="button button-quiet" onClick={load}>
          새로고침
        </button>
      </div>

      <dl className="tally" aria-label="방문 현황">
        {counts.map((c) => (
          <div key={c.label} className="tally-item">
            <dt>{c.label}</dt>
            <dd className="num">{c.value ?? '–'}</dd>
          </div>
        ))}
      </dl>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab is-active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'pending' && summary?.pending > 0 && <span className="tab-count">{summary.pending}</span>}
          </button>
        ))}
        {tab === 'all' && (
          <label className="filter">
            <span className="sr-only">상태 필터</span>
            <select value={allFilter} onChange={(e) => setAllFilter(e.target.value)}>
              {ALL_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>접수번호</th>
              <th>{tab === 'today' ? '시각' : '방문 일시'}</th>
              <th>방문자</th>
              <th>목적</th>
              <th>담당</th>
              <th>상태</th>
              <th className="col-actions">처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const state = visitState(v)
              const busy = busyId === v.id
              const isRejecting = rejecting?.id === v.id
              return (
                <tr key={v.id} className={state === 'IN' ? 'row-in' : undefined}>
                  <td className="num">{passNumber(v.id)}</td>
                  <td className="num">
                    {tab !== 'today' && <span className="date">{formatDate(v.visit_date)}</span>}
                    {formatTime(v.visit_time)}
                  </td>
                  <td>
                    <Visitor visit={v} />
                    {v.note && <span className="note">{v.note}</span>}
                  </td>
                  <td>{v.purpose}</td>
                  <td>{v.host_name}</td>
                  <td>
                    <StateTag visit={v} />
                    {state === 'IN' && <span className="time-mark">{formatClock(v.checked_in_at)} 입실</span>}
                    {state === 'OUT' && (
                      <span className="time-mark">
                        {formatClock(v.checked_in_at)}–{formatClock(v.checked_out_at)}
                      </span>
                    )}
                    {state === 'REJECTED' && v.reject_reason && <span className="time-mark">{v.reject_reason}</span>}
                  </td>
                  <td className="col-actions">
                    {state === 'PENDING' && !isRejecting && (
                      <div className="row-actions">
                        <button type="button" className="button button-small" disabled={busy} onClick={() => act(v.id, () => approveVisit(v.id))}>
                          승인
                        </button>
                        <button type="button" className="button button-small button-quiet" disabled={busy} onClick={() => setRejecting({ id: v.id, reason: '' })}>
                          반려
                        </button>
                      </div>
                    )}
                    {isRejecting && (
                      <form
                        className="reject-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          act(v.id, () => rejectVisit(v.id, rejecting.reason))
                        }}
                      >
                        <input
                          autoFocus
                          value={rejecting.reason}
                          onChange={(e) => setRejecting({ id: v.id, reason: e.target.value })}
                          placeholder="반려 사유 (선택)"
                          maxLength={200}
                          aria-label="반려 사유"
                        />
                        <button type="submit" className="button button-small button-danger" disabled={busy}>
                          반려 확정
                        </button>
                        <button type="button" className="button button-small button-quiet" onClick={() => setRejecting(null)}>
                          취소
                        </button>
                      </form>
                    )}
                    {state === 'EXPECTED' && tab === 'today' && (
                      <button type="button" className="button button-small" disabled={busy} onClick={() => act(v.id, () => checkIn(v.id))}>
                        입실 처리
                      </button>
                    )}
                    {state === 'IN' && (
                      <button type="button" className="button button-small button-quiet" disabled={busy} onClick={() => act(v.id, () => checkOut(v.id))}>
                        퇴실 처리
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && rows.length === 0 && (
          <p className="empty">
            {tab === 'today'
              ? '오늘 승인된 방문이 없습니다. 승인 대기 탭에서 신청을 확인해 보세요.'
              : tab === 'pending'
                ? '승인을 기다리는 신청이 없습니다.'
                : '조건에 맞는 신청이 없습니다.'}
          </p>
        )}
      </div>

      {updatedAt && (
        <p className="updated">
          {updatedAt.toLocaleTimeString('ko-KR', { hour12: false })} 기준 · 20초마다 자동으로 새로고침합니다
        </p>
      )}
    </div>
  )
}
