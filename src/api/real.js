/**
 * The real HTTP client. Not used until USE_MOCK in index.js is flipped to false.
 *
 * Token auth. login() and register() hand back a token, we keep it, and every
 * request from then on carries `Authorization: Token <token>`. No cookies and
 * no CSRF token: a cross-site form can make the browser send a cookie, but it
 * cannot make it send this header, so the attack CSRF exists to stop does not
 * apply here.
 *
 * All requests go to /api, which the Vite dev server proxies to localhost:8000.
 *
 * Moving to JWT later means changing the word "Token" below to "Bearer" and
 * nothing else in the app. That is the whole reason every page imports from
 * ./index instead of calling fetch itself.
 */

const BASE = '/api';

/* Where the token lives between reloads.
   sessionStorage rather than localStorage: it dies with the tab, which matches
   how the mock behaves and stops a shared lab machine staying signed in.

   Worth saying out loud rather than hiding: any token the page's own JavaScript
   can read, injected JavaScript can read too. An HttpOnly cookie is the one
   place a credential is out of XSS's reach, and a header scheme gives that up
   by definition — that is the cost of the backend's choice, not a bug here.
   Keeping it in sessionStorage keeps the blast radius to one tab. */
const TOKEN_KEY = 'canteen.token';

let token = globalThis.sessionStorage?.getItem(TOKEN_KEY) ?? null;

function setToken(value) {
  token = value ?? null;
  if (token) globalThis.sessionStorage?.setItem(TOKEN_KEY, token);
  else globalThis.sessionStorage?.removeItem(TOKEN_KEY);
}

/** On every request now, not just writes — the header IS the credential. */
function authHeaders() {
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure: no response at all.
    const error = new Error('Cannot reach the canteen server.');
    error.status = 0;
    throw error;
  }

  if (response.status === 204) return undefined;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.error || 'Something went wrong. Try again.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

/**
 * Take a sign-in response, keep the token, hand back the plain `user` the rest
 * of the app is written against.
 *
 * Deliberately tolerant about where the token sits, because that envelope is
 * the one thing the backend has not pinned down: DRF's own view returns
 * { token }, dj-rest-auth returns { key }, and a custom serializer usually
 * nests the user under { user }. Reading all three costs two `??` and saves a
 * day of waiting on an answer.
 *
 * The two throws are the point of this function. Without them a backend that
 * forgets the token produces a sign-in that "works" and then 401s on the very
 * next call, which is a miserable thing to debug on integration day.
 *
 * Exported for the test beside this file; nothing else should call it.
 */
export function adopt(payload) {
  const key = payload?.token ?? payload?.key ?? payload?.auth_token;
  if (!key) throw new Error('Signed in, but the server did not send a token.');

  const user = payload.user ?? payload;
  if (user?.username == null) throw new Error('The server sent a sign-in response we did not understand.');

  setToken(key);
  // Only the three fields shapes.js promises. The token deliberately does not
  // travel on into React state — one copy, in one place.
  return { id: user.id, username: user.username, role: user.role };
}

export const login = async (username, password) =>
  adopt(await request('/auth/login/', { method: 'POST', body: { username, password } }));

export const register = async (username, password) =>
  adopt(await request('/auth/register/', { method: 'POST', body: { username, password } }));

/** No token, no question to ask — and no pointless 401 on every first visit.
 *  A 401 with a token means the server has forgotten it, so we forget it too. */
export const getMe = () => {
  if (!token) return Promise.resolve(null);
  return request('/auth/me/').catch((e) => {
    if (e.status !== 401) throw e;
    setToken(null);
    return null;
  });
};

export const logout = async () => {
  try {
    await request('/auth/logout/', { method: 'POST' });
  } catch {
    // ponytail: a failed logout call still signs you out here. The token is
    // gone from this browser either way and the server can expire its own copy
    // — leaving someone apparently signed in because the network blipped is
    // the worse failure.
  }
  setToken(null);
};

export const getMenu = () => request('/menu/');

export const placeOrder = (items) => request('/orders/', { method: 'POST', body: { items } });

export const getOrders = () => request('/orders/');

export const getOrder = (id) => request(`/orders/${id}/`);

export const setStatus = (id, status) =>
  request(`/orders/${id}/status/`, { method: 'PATCH', body: { status } });
