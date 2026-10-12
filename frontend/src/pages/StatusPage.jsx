import { useEffect, useState } from 'react'
import { getVisit } from '../api.js'
import VisitorPass from '../components/VisitorPass.jsx'

function initialNumber() {
  return new URLSearchParams(window.location.search).get('no') ?? ''
}

export default function StatusPage() {
  const [number, setNumber] = useState(initialNumber)
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function lookup(no) {
    const id = Number(String(no).replace(/\D/g, ''))
    if (!id) {
      setError('접수번호를 숫자로 입력해 주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      setVisit(await getVisit(id))
      window.history.replaceState({}, '', `/status?no=${id}`)
    } catch (err) {
      setVisit(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialNumber()) lookup(initialNumber())
  }, [])

  return (
    <div className="split">
      <section className="split-main">
        <h1 className="page-title">신청 조회</h1>
        <p className="lead">신청할 때 받은 접수번호로 승인 여부와 방문 기록을 확인합니다.</p>

        <form
          className="lookup"
          onSubmit={(e) => {
            e.preventDefault()
            lookup(number)
          }}
        >
          <label className="field">
            <span>접수번호</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" placeholder="예: 0007" />
          </label>
          <button type="submit" className="button" disabled={loading}>
            {loading ? '조회하는 중…' : '조회하기'}
          </button>
        </form>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <aside className="split-side">{visit && <VisitorPass visit={visit} />}</aside>
    </div>
  )
}
