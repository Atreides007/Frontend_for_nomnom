import { createContext, useContext, useMemo, useState } from 'react';
import { setQty as nextLines } from './lib/cartLines';

/**
 * The cart. Lives above the routes because /menu unmounts when you walk over
 * to /cart, and a cart that empties itself on navigation is not a cart.
 *
 * A line is `{ id, qty }` and nothing else. Names and prices are read from the
 * menu when we need to show them, and the total is computed by the server when
 * the order is placed — the client never sends money it worked out itself.
 */
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);

  const value = useMemo(
    () => ({
      lines,

      qtyOf: (id) => lines.find((line) => line.id === id)?.qty ?? 0,

      /** One setter for add, change and remove. qty 0 drops the line.
       *  The logic itself lives in lib/cartLines.js, where it is tested. */
      setQty(id, qty) {
        setLines((current) => nextLines(current, id, qty));
      },

      clear: () => setLines([]),
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart must be used inside <CartProvider>');
  return cart;
}
