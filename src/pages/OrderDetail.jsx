import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { STATUS_LABELS, STATUSES } from '../api/shapes';
import { usePoll } from '../hooks/usePoll';
import { rupees } from '../lib/money';
import { token } from '../lib/token';
import './OrderDetail.css';

const POLL_MS = 5000;

/** One line under the bill, saying what to do now rather than what happened.
 *  The status word above is the state; this is the instruction. */
const ADVICE = {
  PLACED: 'Show this token at the counter and pay when you collect.',
  PREPARING: 'Being cooked now. Show this token at the counter.',
  READY: 'Ready — collect it at the counter and pay there.',
  COLLECTED: 'Collected. Thanks!',
};

/**
 * One order, live. This is the screen a student holds up at the counter, so
 * the token number is the biggest thing on it and everything else is smaller
 * than the food.
 */
export default function OrderDetail() {
  const { id } = useParams();

  // usePoll restarts its loop whenever the fetcher changes, so this has to be
  // stable — it may only be rebuilt when the id in the URL actually changes.
  const fetchOrder = useCallback(() => api.getOrder(id), [id]);
  const { data: order, error, isLoading } = usePoll(fetchOrder, POLL_MS);

  if (isLoading) {
    return (
      <main className="order">
        <p className="order__note">Loading…</p>
      </main>
    );
  }

  // Only a first fetch that failed lands here — after that the last good order
  // stays on screen and the banner below carries the failure.
  if (!order) {
    return (
      <main className="order">
        <p className="order__note">{error?.message ?? 'That order does not exist.'}</p>
        <p className="order__note">
          <Link to="/orders">Back to your orders</Link>
        </p>
      </main>
    );
  }

  const placed = new Date(order.created_at);

  return (
    <main className="order">
      <header className="order__head">
        <Link to="/orders" className="order__back">
          Your orders
        </Link>
      </header>

      <section className="order__token">
        <p className="order__label">Token</p>
        <p className="order__number num">#{token(order.id)}</p>
        <p className="order__placed">
          Placed at {placed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </section>

      <Track status={order.status} />

      {error && (
        <p className="order__error" role="status">
          Not updating — {error.message}
        </p>
      )}

      <ul className="order__lines panel">
        {order.items.map((item) => (
          <li key={item.name} className="oline">
            <span className="oline__qty num">{item.qty}×</span>
            <span className="oline__name">{item.name}</span>
            <span className="oline__price num">{rupees(item.price * item.qty)}</span>
          </li>
        ))}

        <li className="oline oline--total">
          <span className="oline__name">Total</span>
          <span className="oline__price num">{rupees(order.total)}</span>
        </li>
      </ul>

      <p className="order__terms">{ADVICE[order.status]}</p>
    </main>
  );
}

/**
 * The four states as a row of steps, with everything up to and including the
 * current one filled. A student wants "how far along is my food", and a list
 * of steps answers that in one look — a single word does not say what comes
 * next or what has already happened.
 */
function Track({ status }) {
  const reached = STATUSES.indexOf(status);

  return (
    <ol className="track" aria-label={`Status: ${STATUS_LABELS[status]}`}>
      {STATUSES.map((step, i) => (
        <li
          key={step}
          className={`track__step${i <= reached ? ' is-done' : ''}${i === reached ? ' is-now' : ''}`}
          aria-current={i === reached ? 'step' : undefined}
        >
          <span className="track__dot" />
          <span className="track__name">{STATUS_LABELS[step]}</span>
        </li>
      ))}
    </ol>
  );
}
