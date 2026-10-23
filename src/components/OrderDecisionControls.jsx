import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

function completedDecision(paStatus) {
  const value = String(paStatus || '').toUpperCase()
  if (value === 'RELEASED') return 'RELEASE'
  if (value === 'REFUNDED') return 'REFUND'
  return ''
}

function remainingSeconds(sendAt) {
  const deadline = new Date(sendAt).getTime()
  return Number.isNaN(deadline) ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

function timerLabel(seconds) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export default function OrderDecisionControls({ paControl, paStatus, acting, onDecision, onRevoke, onFinalize }) {
  const [confirmation, setConfirmation] = useState(null)
  const decisionWindow = paControl?.decision_window || {}
  const windowPending = decisionWindow.status === 'PENDING' && !paControl?.aggregator_request
  const stagedDecision = windowPending ? String(decisionWindow.decision || '').toUpperCase() : ''
  const requestedDecision = String(paControl?.aggregator_request?.decision || '').toUpperCase()
  const finalDecision = requestedDecision || completedDecision(paStatus)
  const unavailable = !paControl?.vaultpay_order_id
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(decisionWindow.send_at))
  const finalizingRef = useRef(false)
  const finalizeRef = useRef(onFinalize)

  useEffect(() => {
    finalizeRef.current = onFinalize
  }, [onFinalize])

  useEffect(() => {
    finalizingRef.current = false
    if (!windowPending) {
      setSecondsLeft(0)
      return undefined
    }
    const tick = () => {
      const next = remainingSeconds(decisionWindow.send_at)
      setSecondsLeft(next)
      if (next === 0 && !finalizingRef.current) {
        finalizingRef.current = true
        Promise.resolve(finalizeRef.current()).finally(() => {
          finalizingRef.current = false
        })
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [decisionWindow.send_at, windowPending])

  function standardLabel(decision) {
    return decision === 'REFUND' ? 'Refund decision' : 'Release decision'
  }

  function labelFor(decision) {
    if (finalDecision === decision) {
      if (requestedDecision === decision) return `${decision === 'REFUND' ? 'Refund' : 'Release'} request sent`
      return decision === 'REFUND' ? 'Refunded' : 'Released'
    }
    if (stagedDecision === decision) return `Revoke ${decision.toLowerCase()} decision`
    return standardLabel(decision)
  }

  const confirmationDecision = confirmation?.decision || ''
  const isRevoke = confirmation?.mode === 'revoke'

  return (
    <>
      <div className="ir-decision-control">
        <div className="ir-decision-actions" aria-label="Order financial decision">
          {['REFUND', 'RELEASE'].map((decision) => {
            const selected = finalDecision === decision
            const staged = stagedDecision === decision
            return (
              <div className="ir-decision-option" key={decision}>
                <button
                  type="button"
                  className={`ir-decision-btn${selected ? ' is-selected' : ''}${staged ? ' is-pending' : ''}`}
                  disabled={acting || unavailable || Boolean(finalDecision) || (Boolean(stagedDecision) && !staged)}
                  onClick={() => setConfirmation({ mode: staged ? 'revoke' : 'send', decision })}
                  title={unavailable ? 'This order is not available in PA Control.' : ''}
                >
                  {selected ? <span aria-hidden="true">✓</span> : null}
                  {labelFor(decision)}
                </button>
                {staged ? (
                  <div className="ir-decision-timer" role="timer" aria-live="polite">
                    <span>Revoke within</span>
                    <strong>{timerLabel(secondsLeft)}</strong>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      {confirmation ? (
        <Modal title={isRevoke ? 'Confirm decision revocation' : 'Confirm financial decision'} onClose={() => !acting && setConfirmation(null)} width={460}>
          <div className="ir-decision-confirm">
            <p>
              {isRevoke ? (
                <>Are you sure you want to revoke the <strong>{confirmationDecision.toLowerCase()}</strong> decision? You can then choose the other decision.</>
              ) : (
                <>Are you sure you want to stage a <strong>{confirmationDecision.toLowerCase()}</strong> request? You will have 10 minutes to revoke it before it is sent automatically to PA Control.</>
              )}
            </p>
            <div className="ir-decision-confirm-actions">
              <button type="button" className="ir-decision-cancel" disabled={acting} onClick={() => setConfirmation(null)}>Go back</button>
              <button
                type="button"
                className="ir-decision-confirm-btn"
                disabled={acting}
                onClick={async () => {
                  const completed = isRevoke ? await onRevoke() : await onDecision(confirmationDecision)
                  if (completed) setConfirmation(null)
                }}
              >
                {acting ? 'Please wait...' : isRevoke ? 'Yes, revoke decision' : `Yes, stage ${confirmationDecision.toLowerCase()} request`}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
