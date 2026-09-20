/**
 * THE API CONTRACT — single source of truth.
 *
 * Every shape the frontend depends on lives here. When the real backend
 * disagrees, change it here first, then fix the two files that produce these
 * shapes: mock.js and real.js. No page should ever invent a field.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * menuItem = {
 *   id:          number       // stable, used as the cart key
 *   name:        string       // "Masala Dosa"
 *   description: string       // one short line, may be ""
 *   price:       number       // rupees, plain number — NOT a string, NOT paise
 *   category:    string       // free text; pages group by exact match
 *   available:   boolean      // false = shown but not orderable
 * }
 *
 * order = {
 *   id:         number        // small int, shown as a token number: #042
 *   status:     OrderStatus   // see below
 *   total:      number        // rupees; backend computes it, we never trust ours
 *   created_at: string        // ISO 8601, e.g. "2026-09-19T10:24:05Z"
 *   items:      orderItem[]
 * }
 *
 * orderItem = {
 *   name:  string             // snapshot of the name AT ORDER TIME
 *   qty:   number
 *   price: number             // per-unit price AT ORDER TIME, not today's price
 * }
 *
 * user = {
 *   id:       number
 *   username: string
 *   role:     "student" | "staff" | "manager"
 * }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CALLS
 *
 * login(username, password)  -> user      // response also carries the auth
 *                                         // token; real.js keeps it and
 *                                         // strips it before returning
 * register(username, password) -> user    // registers as "student", same token
 * getMe()                    -> user | null   // null when not signed in
 * logout()                   -> void
 * getMenu()                  -> menuItem[]
 * placeOrder(items)          -> order     // items: [{ id, qty }] — menuItem ids
 * getOrders()                -> order[]   // student: own orders, newest first
 *                                         // staff/manager: all ACTIVE orders
 * getOrder(id)               -> order
 * setStatus(id, status)      -> order     // the updated order
 *
 * Errors: every call rejects with an Error whose .message is safe to show to
 * a user, and .status carrying the HTTP status when there is one.
 */

/** The four order states, in the exact order an order moves through them. */
export const STATUSES = ['PLACED', 'PREPARING', 'READY', 'COLLECTED'];

/** Human labels. The kitchen board and the student pages read differently. */
export const STATUS_LABELS = {
  PLACED: 'Placed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COLLECTED: 'Collected',
};

/** Columns on the kitchen board, left to right. COLLECTED leaves the board. */
export const BOARD_COLUMNS = ['PLACED', 'PREPARING', 'READY'];

/** What one tap on a kitchen card does. null = nothing further to advance to. */
export function nextStatus(status) {
  const i = STATUSES.indexOf(status);
  return i === -1 || i === STATUSES.length - 1 ? null : STATUSES[i + 1];
}

export const ROLES = ['student', 'staff', 'manager'];

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE = {
  student: '/menu',
  staff: '/kitchen',
  manager: '/kitchen',
};
