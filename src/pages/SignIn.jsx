import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HOME_FOR_ROLE } from '../api/shapes';
import ramen from '../assets/ramen.webp';
import { useAuth } from '../auth';
import './SignIn.css';

/**
 * One form, two doors. Signing in and registering ask for exactly the same two
 * fields and differ only in which call they make and what the button says, so
 * they are the same component mounted at two routes rather than two pages that
 * would drift apart.
 */
export default function SignIn({ mode }) {
  const isRegister = mode === 'register';
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);

  async function submit(event) {
    // The browser validates required and minlength before we get here; this
    // stops it reloading the page with the fields in the URL.
    event.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      const user = isRegister ? await signUp(username, password) : await signIn(username, password);
      // Back to whatever they were trying to reach, or to the screen their
      // role starts at. replace, so Back does not return to this form.
      const from = location.state?.from;
      navigate(from ?? HOME_FOR_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(err.message);
      setIsSending(false); // stays mounted on failure, so no live check needed
    }
  }

  return (
    <main className="signin">
      {/* The partition: the form on one side, the bowl on the other. Above
          60rem they are two halves of the page; below it the bowl slides
          behind the card and becomes the backdrop, because a phone has one
          column and the form is the one that matters. */}
      <div className="signin__pane">
        <form className="signin__card" onSubmit={submit}>
          <h1 className="signin__title">{isRegister ? 'Create an account' : 'Campus Canteen'}</h1>
          <p className="signin__sub">
            {isRegister
              ? 'New accounts order food. Kitchen accounts are made by the canteen manager.'
              : 'Sign in to order, or to open the kitchen board.'}
          </p>

          <label className="field">
            <span className="field__label">Username</span>
            <input
              name="username"
              autoComplete="username"
              required
              minLength={3}
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="signin__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="signin__go" disabled={isSending}>
            {isSending ? 'Just a moment…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="signin__swap">
            {isRegister ? (
              <>
                Already have one? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                No account yet? <Link to="/register">Create one</Link>
              </>
            )}
          </p>
        </form>
      </div>

      {/* A figure, not a bare image: the photograph is decoration and carries
          an empty alt, but the line under it is worth reading, so the caption
          stays in the accessibility tree. */}
      <figure className="signin__art">
        <img className="signin__bowl" src={ramen} alt="" width="1200" height="1200" />
        <figcaption className="signin__quote">
          <q>Nobody thinks straight on an empty stomach.</q>
        </figcaption>
      </figure>
    </main>
  );
}
