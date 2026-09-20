/**
 * In-memory fake backend. Same call signatures as real.js, same shapes as
 * shapes.js. Nothing here touches the network — that is the point, and the
 * built output should contain no fetch to anywhere.
 *
 * State lives in module scope, so it survives navigation but resets on reload.
 */

import { STATUSES, nextStatus } from './shapes';

// ── plumbing ──────────────────────────────────────────────────────────────

const latency = () => 200 + Math.random() * 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve after a realistic delay, with a deep copy so callers can't mutate
 *  our state by accident. Same discipline the real API gives us for free. */
async function reply(value) {
  await sleep(latency());
  return structuredClone(value);
}

async function fail(message, status = 400) {
  await sleep(latency());
  const error = new Error(message);
  error.status = status;
  throw error;
}

// ── seed data ─────────────────────────────────────────────────────────────

const MENU = [
  { id: 1, name: 'Masala Dosa', description: 'Crisp rice crêpe, potato masala, coconut chutney', price: 60, category: 'South Indian', available: true },
  { id: 2, name: 'Idli Sambar', description: 'Two steamed idlis in hot sambar', price: 40, category: 'South Indian', available: true },
  { id: 3, name: 'Medu Vada', description: 'Two lentil doughnuts, coconut chutney', price: 35, category: 'South Indian', available: true },
  { id: 4, name: 'Poha', description: 'Flattened rice, peanuts, curry leaves', price: 30, category: 'South Indian', available: true },

  { id: 10, name: 'Veg Thali', description: 'Dal, sabzi, rice, four rotis, salad, pickle', price: 90, category: 'Meals', available: true },
  { id: 11, name: 'Rajma Chawal', description: 'Kidney bean curry over steamed rice', price: 70, category: 'Meals', available: true },
  { id: 12, name: 'Chole Bhature', description: 'Spiced chickpeas, two fried bhature', price: 80, category: 'Meals', available: true },
  { id: 13, name: 'Paneer Butter Masala', description: 'With two butter rotis', price: 110, category: 'Meals', available: true },

  { id: 20, name: 'Veg Sandwich', description: 'Grilled, mint chutney, three layers', price: 45, category: 'Snacks', available: true },
  { id: 21, name: 'Samosa', description: 'Two, with tamarind and mint chutney', price: 25, category: 'Snacks', available: true },
  { id: 22, name: 'Pav Bhaji', description: 'Buttered pav, mashed vegetable bhaji', price: 65, category: 'Snacks', available: true },
  { id: 23, name: 'Maggi', description: 'Masala, with extra vegetables', price: 40, category: 'Snacks', available: true },

  { id: 30, name: 'Masala Chai', description: 'Ginger and cardamom', price: 15, category: 'Drinks', available: true },
  { id: 31, name: 'Filter Coffee', description: 'Strong, in a steel tumbler', price: 20, category: 'Drinks', available: true },
  { id: 32, name: 'Fresh Lime Soda', description: 'Sweet, salted, or mixed', price: 30, category: 'Drinks', available: true },
  { id: 33, name: 'Cold Coffee', description: 'Blended, with ice cream', price: 50, category: 'Drinks', available: true },
];

const USERS = [
  { id: 1, username: 'student', password: 'student', role: 'student' },
  { id: 2, username: 'kitchen', password: 'kitchen', role: 'staff' },
  { id: 3, username: 'manager', password: 'manager', role: 'manager' },
];

// ── mutable state ─────────────────────────────────────────────────────────

let orders = [];
let nextOrderId = 41; // so the first order reads #042 — canteens don't start at 1
/* The real API keeps the session in a cookie the browser hands back after a
   refresh. The mock has no cookie, so it borrows sessionStorage — without it
   every reload signs you out, which is not how the built app behaves.
   ponytail: the username only, looked back up in USERS. Storing the whole
   user object would go stale the moment USERS changes. */
const SESSION_KEY = 'canteen.session';

let session = USERS.find((u) => u.username === sessionStorage?.getItem(SESSION_KEY)) ?? null;

function setSession(user) {
  session = user;
  if (user) sessionStorage?.setItem(SESSION_KEY, user.username);
  else sessionStorage?.removeItem(SESSION_KEY);
}

/** Orders the mock generator invents belong to this phantom student, so they
 *  never show up in the real signed-in student's "My Orders". */
const PHANTOM_USER_ID = 99;

function makeOrder({ userId, items, createdAt = new Date(), status = 'PLACED' }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return {
    id: nextOrderId++,
    user_id: userId, // internal to the mock; not part of the public shape
    status,
    total,
    created_at: createdAt.toISOString(),
    items,
  };
}

/** Seed the board so the kitchen display isn't empty on first load. */
(function seedBoard() {
  const now = Date.now();
  const pick = (id, qty) => {
    const m = MENU.find((x) => x.id === id);
    return { name: m.name, qty, price: m.price };
  };
  const seeds = [
    { mins: 14, status: 'PREPARING', items: [pick(10, 1), pick(30, 2)] },
    { mins: 9, status: 'PLACED', items: [pick(1, 2), pick(31, 1)] },
    { mins: 6, status: 'READY', items: [pick(21, 3)] },
    { mins: 2, status: 'PLACED', items: [pick(12, 1), pick(32, 1), pick(23, 1)] },
  ];
  for (const s of seeds) {
    orders.push(
      makeOrder({
        userId: PHANTOM_USER_ID,
        items: s.items,
        status: s.status,
        createdAt: new Date(now - s.mins * 60_000),
      }),
    );
  }
})();

// ── the live-demo order generator ─────────────────────────────────────────

let generatorTimer = null;

/** Drop a new PLACED order onto the board every 20–30s so the kitchen display
 *  visibly updates during a demo. Started lazily, only for kitchen-side users. */
function startGenerator() {
  if (generatorTimer) return;
  const tick = () => {
    const available = MENU.filter((m) => m.available);
    const count = 1 + Math.floor(Math.random() * 3);
    const chosen = [];
    for (let i = 0; i < count; i++) {
      const m = available[Math.floor(Math.random() * available.length)];
      const existing = chosen.find((c) => c.name === m.name);
      if (existing) existing.qty += 1;
      else chosen.push({ name: m.name, qty: 1 + Math.floor(Math.random() * 2), price: m.price });
    }
    orders.push(makeOrder({ userId: PHANTOM_USER_ID, items: chosen }));
    generatorTimer = setTimeout(tick, 20_000 + Math.random() * 10_000);
  };
  generatorTimer = setTimeout(tick, 20_000 + Math.random() * 10_000);
}

// ── the API ───────────────────────────────────────────────────────────────

export async function login(username, password) {
  const found = USERS.find((u) => u.username === username && u.password === password);
  if (!found) return fail('That username and password do not match.', 401);
  setSession(found);
  return reply(publicUser(found));
}

export async function register(username, password) {
  if (!username || username.length < 3) return fail('Pick a username of at least 3 characters.');
  if (!password || password.length < 4) return fail('Pick a password of at least 4 characters.');
  if (USERS.some((u) => u.username === username)) return fail('That username is taken.', 409);
  const created = { id: USERS.length + 1, username, password, role: 'student' };
  USERS.push(created);
  setSession(created);
  return reply(publicUser(created));
}

export async function getMe() {
  return reply(session ? publicUser(session) : null);
}

export async function logout() {
  setSession(null);
  return reply(undefined);
}

export async function getMenu() {
  return reply(MENU);
}

/** items: [{ id, qty }] using menuItem ids. */
export async function placeOrder(items) {
  if (!session) return fail('Sign in to place an order.', 401);
  if (!Array.isArray(items) || items.length === 0) return fail('Your cart is empty.');

  const lines = [];
  for (const { id, qty } of items) {
    const item = MENU.find((m) => m.id === id);
    if (!item) return fail('Something in your cart is no longer on the menu.');
    if (!item.available) return fail(`${item.name} just went off the menu. Remove it to continue.`);
    if (!Number.isInteger(qty) || qty < 1) return fail('Quantities must be whole numbers of at least 1.');
    lines.push({ name: item.name, qty, price: item.price });
  }

  const order = makeOrder({ userId: session.id, items: lines });
  orders.push(order);
  return reply(strip(order));
}

/**
 * Add `?flaky` to the URL to make roughly half of all refreshes fail.
 *
 * The kitchen board is required to survive a dropped request without blanking
 * itself, and with an in-memory mock there is no network to unplug. This is
 * the switch that makes that behaviour demonstrable — visit
 * /kitchen?flaky and watch the banner come and go while the tickets stay put.
 */
const FLAKY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('flaky');

export async function getOrders() {
  if (!session) return fail('Sign in to see your orders.', 401);
  if (FLAKY && Math.random() < 0.5) {
    await sleep(latency());
    return fail('Cannot reach the canteen server.', 0);
  }
  if (session.role === 'student') {
    const mine = orders.filter((o) => o.user_id === session.id);
    return reply(mine.slice().reverse().map(strip));
  }
  startGenerator();
  const active = orders.filter((o) => o.status !== 'COLLECTED');
  return reply(active.map(strip));
}

export async function getOrder(id) {
  if (!session) return fail('Sign in to see your orders.', 401);
  const order = orders.find((o) => o.id === Number(id));
  if (!order) return fail('That order does not exist.', 404);
  if (session.role === 'student' && order.user_id !== session.id) {
    return fail('That order does not exist.', 404);
  }
  return reply(strip(order));
}

export async function setStatus(id, status) {
  if (!session) return fail('Sign in to update orders.', 401);
  if (session.role === 'student') return fail('Only kitchen staff can change an order status.', 403);
  if (!STATUSES.includes(status)) return fail(`Unknown status: ${status}`);
  const order = orders.find((o) => o.id === Number(id));
  if (!order) return fail('That order does not exist.', 404);
  if (nextStatus(order.status) !== status) {
    // Guards against a double-tap advancing an order two steps.
    return fail(`An order at ${order.status} cannot move to ${status}.`, 409);
  }
  order.status = status;
  return reply(strip(order));
}

// ── helpers ───────────────────────────────────────────────────────────────

function publicUser({ id, username, role }) {
  return { id, username, role };
}

/** Drop mock-only fields so pages can never depend on something the real
 *  backend won't send. */
function strip({ id, status, total, created_at, items }) {
  return { id, status, total, created_at, items };
}
