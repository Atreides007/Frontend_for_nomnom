/**
 * The real HTTP client. Not used until USE_MOCK in index.js is flipped to false.
 *
 * Written for Django session auth: the browser holds the sessionid cookie, we
 * send it with every request, and mutating calls carry the CSRF token Django
 * put in the csrftoken cookie. All requests go to /api, which the Vite dev
 * server proxies to localhost:8000 — so the cookie is same-origin and just works.
 *
 * Switching to token/JWT auth means changing ONE function below (authHeaders)
 * and nothing else in the app. That is why every page imports from ./index
 * instead of calling fetch itself.
 */

const BASE = '/api';

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Session auth needs CSRF on writes. For JWT, return { Authorization: `Bearer ${token}` }. */
function authHeaders(method) {
  if (method === 'GET') return {};
  const csrf = readCookie('csrftoken');
  return csrf ? { 'X-CSRFToken': csrf } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(method),
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

export const login = (username, password) =>
  request('/auth/login/', { method: 'POST', body: { username, password } });

export const register = (username, password) =>
  request('/auth/register/', { method: 'POST', body: { username, password } });

export const getMe = () => request('/auth/me/').catch((e) => (e.status === 401 ? null : Promise.reject(e)));

export const logout = () => request('/auth/logout/', { method: 'POST' });

export const getMenu = () => request('/menu/');

export const placeOrder = (items) => request('/orders/', { method: 'POST', body: { items } });

export const getOrders = () => request('/orders/');

export const getOrder = (id) => request(`/orders/${id}/`);

export const setStatus = (id, status) =>
  request(`/orders/${id}/status/`, { method: 'PATCH', body: { status } });
