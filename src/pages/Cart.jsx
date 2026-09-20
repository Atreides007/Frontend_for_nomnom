import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Receipt from '../components/Receipt';
import Stepper from '../components/Stepper';
import { useCart } from '../cart';
import { rupees } from '../lib/money';
import './Cart.css';

/**
 * Cart and checkout in one screen. There is no address, no delivery slot and
 * no payment step — you walk to the counter and pay there — so splitting this
 * across two pages would be ceremony around a single button.
 */
export default function Cart() {
  const cart = useCart();
  const [menu, setMenu] = useState(null);
  const [placed, setPlaced] = useState(null); // the order, once it exists
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let live = true;
    api.getMenu().then(
      (items) => live && setMenu(items),
      (err) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  async function placeOrder() {
    setIsSending(true);
    setError(null);
    try {
      const order = await api.placeOrder(cart.lines);
      // Only clear once the server has the order. Clearing optimistically and
      // then failing would leave someone with no cart and no order.
      cart.clear();
      setPlaced(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  if (placed) return <Receipt order={placed} />;

  if (!menu) {
    return (
      <main className="cart">
        <p className="cart__note">
          {error ? `Could not load your order — ${error}. Reload to try again.` : 'Loading…'}
        </p>
      </main>
    );
  }

  const rows = cart.lines
    .map((line) => ({ ...line, item: menu.find((m) => m.id === line.id) }))
    .filter((row) => row.item);

  const total = rows.reduce((sum, row) => sum + row.item.price * row.qty, 0);

  return (
    <main className="cart">
      <header className="cart__head">
        <h1>Your order</h1>
        <Link to="/menu" className="cart__back">
          Back to menu
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="cart__note">Nothing in the cart yet. Pick something from the menu.</p>
      ) : (
        <>
          <ul className="lines panel">
            {rows.map((row) => (
              <li key={row.id} className="line">
                <span className="line__name">{row.item.name}</span>
                <span className="line__price num">{rupees(row.item.price * row.qty)}</span>
                <Stepper
                  qty={row.qty}
                  label={row.item.name}
                  onChange={(next) => cart.setQty(row.id, next)}
                />
              </li>
            ))}

            <li className="line line--total">
              <span className="line__name">Total</span>
              <span className="line__price num">{rupees(total)}</span>
            </li>
          </ul>

          {error && (
            <p className="cart__error" role="alert">
              {error}
            </p>
          )}

          <button type="button" className="cart__place" onClick={placeOrder} disabled={isSending}>
            {isSending ? 'Placing…' : `Place order · ${rupees(total)}`}
          </button>

          <p className="cart__terms">
            The kitchen starts as soon as you place this. Pay at the counter when you collect.
          </p>
        </>
      )}
    </main>
  );
}
