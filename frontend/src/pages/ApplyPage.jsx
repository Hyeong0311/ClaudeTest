import { useState } from 'react'
import { Link } from '../router.jsx'
import { createVisit } from '../api.js'
import VisitorPass from '../components/VisitorPass.jsx'
import { PURPOSES, passNumber, todayKST } from '../labels.js'

const emptyForm = () => ({
  visitor_name: '',
  company: '',
  visit_date: todayKST(),
  visit_time: '10:00',
  purpose: PURPOSES[0],
  host_name: '',
  note: '',
})

export default function ApplyPage() {
  const [form, setForm] = useState(emptyForm)
  const [issued, setIssued] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      setIssued(await createVisit(form))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    setIssued(null)
    setForm(emptyForm())
  }

  return (
    <div className="split">
      <section className="split-main">
        {issued ? (
          <div className="done">
            <h1 className="page-title">신청이 접수됐습니다</h1>
            <p className="lead">
              접수번호 <strong className="num">{passNumber(issued.id)}</strong>번으로 승인 여부를 확인할 수 있습니다. 담당
              직원이 승인하면 방문 당일 안내데스크에서 접수번호를 알려주세요.
            </p>
            <div className="actions">
              <Link to={`/status?no=${issued.id}`} className="button">
                접수 상태 확인
              </Link>
              <button type="button" className="button button-quiet" onClick={startOver}>
                새로 신청하기
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="page-title">방문 신청</h1>
            <p className="lead">방문 정보를 입력하면 담당 직원에게 승인 요청이 전달됩니다.</p>

            <form className="form" onSubmit={handleSubmit}>
              <div className="field-row">
                <label className="field">
                  <span>방문자 이름</span>
                  <input value={form.visitor_name} onChange={update('visitor_name')} maxLength={50} required />
                </label>
                <label className="field">
                  <span>소속 회사</span>
                  <input value={form.company} onChange={update('company')} maxLength={100} required />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>방문일</span>
                  <input type="date" value={form.visit_date} min={todayKST()} onChange={update('visit_date')} required />
                </label>
                <label className="field">
                  <span>방문 시각</span>
                  <input type="time" value={form.visit_time} step={600} onChange={update('visit_time')} required />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>방문 목적</span>
                  <select value={form.purpose} onChange={update('purpose')}>
                    {PURPOSES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>만날 직원</span>
                  <input value={form.host_name} onChange={update('host_name')} maxLength={50} required />
                </label>
              </div>

              <label className="field">
                <span>
                  전달 사항 <em>선택</em>
                </span>
                <textarea
                  value={form.note}
                  onChange={update('note')}
                  maxLength={200}
                  rows={3}
                  placeholder="반입 장비, 주차 필요 여부 등"
                />
              </label>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              <div className="actions">
                <button type="submit" className="button" disabled={saving}>
                  {saving ? '신청하는 중…' : '방문 신청하기'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <aside className="split-side">
        <VisitorPass visit={issued ?? form} preview={!issued} />
      </aside>
    </div>
  )
}
