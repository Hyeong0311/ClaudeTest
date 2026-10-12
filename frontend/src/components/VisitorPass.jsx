import { STATE_LABEL, formatClock, formatDate, formatTime, passNumber, visitState } from '../labels.js'

// 방문증 카드. 신청 화면에서는 입력하는 대로 미리보기로, 조회 화면에서는 발급된 상태로 보여준다.
export default function VisitorPass({ visit, preview = false }) {
  const state = preview ? 'DRAFT' : visitState(visit)
  const name = visit.visitor_name?.trim() || '방문자 이름'
  const company = visit.company?.trim() || '소속 회사'

  return (
    <article className={`pass pass-${state.toLowerCase()}`} aria-label="방문증">
      <div className="pass-strap">
        <span className="pass-slot" aria-hidden="true" />
        <span className="pass-kind">방문증</span>
        <span className="pass-no">{preview ? '접수 전' : `No. ${passNumber(visit.id)}`}</span>
      </div>

      <div className="pass-body">
        <p className={visit.visitor_name?.trim() ? 'pass-name' : 'pass-name is-placeholder'}>{name}</p>
        <p className={visit.company?.trim() ? 'pass-company' : 'pass-company is-placeholder'}>{company}</p>

        <dl className="pass-facts">
          <div>
            <dt>방문 일시</dt>
            <dd>
              {visit.visit_date ? formatDate(visit.visit_date) : '-'} {formatTime(visit.visit_time)}
            </dd>
          </div>
          <div>
            <dt>방문 목적</dt>
            <dd>{visit.purpose || '-'}</dd>
          </div>
          <div>
            <dt>담당 직원</dt>
            <dd>{visit.host_name?.trim() || '-'}</dd>
          </div>
        </dl>
      </div>

      <div className="pass-foot">
        {preview ? (
          <span className="pass-hint">신청하면 접수번호가 발급됩니다</span>
        ) : (
          <>
            <span className={`stamp stamp-${state.toLowerCase()}`}>{STATE_LABEL[state]}</span>
            {state === 'REJECTED' && visit.reject_reason && <span className="pass-hint">사유: {visit.reject_reason}</span>}
            {state === 'PENDING' && <span className="pass-hint">담당자 승인 후 방문할 수 있습니다</span>}
            {state === 'EXPECTED' && <span className="pass-hint">방문 당일 안내데스크에 접수번호를 알려주세요</span>}
            {state === 'IN' && <span className="pass-hint">{formatClock(visit.checked_in_at)} 입실</span>}
            {state === 'OUT' && (
              <span className="pass-hint">
                {formatClock(visit.checked_in_at)} 입실 · {formatClock(visit.checked_out_at)} 퇴실
              </span>
            )}
          </>
        )}
      </div>
    </article>
  )
}
