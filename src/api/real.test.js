import assert from 'node:assert/strict';
import test from 'node:test';

/* real.js reads sessionStorage the moment it is imported, so the stub has to be
   in place before the import. A Map is the whole of the Storage API we use. */
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { adopt } = await import('./real.js');

const TOKEN_KEY = 'canteen.token';
const USER = { id: 2, username: 'kitchen', role: 'staff' };

test('keeps the token and returns the user — flat envelope', () => {
  assert.deepEqual(adopt({ ...USER, token: 'abc123' }), USER);
  assert.equal(store.get(TOKEN_KEY), 'abc123');
});

test('accepts dj-rest-auth\'s "key" and a nested user', () => {
  assert.deepEqual(adopt({ key: 'def456', user: USER }), USER);
  assert.equal(store.get(TOKEN_KEY), 'def456');
});

test('the token never travels on to the caller', () => {
  const me = adopt({ ...USER, token: 'ghi789', password_hash: 'nope' });
  assert.deepEqual(Object.keys(me).sort(), ['id', 'role', 'username']);
});

test('a response with no token fails loudly instead of half-signing-in', () => {
  store.set(TOKEN_KEY, 'previous');
  assert.throws(() => adopt(USER), /did not send a token/);
  // and the old token is left alone rather than clobbered by a bad response
  assert.equal(store.get(TOKEN_KEY), 'previous');
});

test('a token with no recognisable user fails too', () => {
  assert.throws(() => adopt({ token: 'abc', detail: 'ok' }), /did not understand/);
});
