import React, { useEffect, useState } from "react";
import {
  googleLogin,
  login,
  register,
  validateAccessCode,
  setPendingSignupCode,
} from "../firebase";
import logo1 from "../assets/logo1.png";

export default function LoginPanel({
  onSuccess,
  onError,
  verifying,
  serverError,
}) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'register'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // App.jsx is the sole authority on granting access (see its onAuthChange
  // handler) — it verifies the profile/redeems the code AFTER sign-in
  // succeeds, then reports back here if that verification rejected the user.
  useEffect(() => {
    if (serverError) setError(serverError);
  }, [serverError]);

  const friendlyAuthError = (err) => {
    if (err.code === "auth/configuration-not-found") {
      return "Sign-in is not enabled. Please enable it in your Firebase Console under Authentication > Sign-in method.";
    }
    if (err.code === "auth/popup-blocked")
      return "Sign-in popup was blocked. Please allow popups and try again.";
    if (
      err.code === "auth/cancelled-popup-request" ||
      err.code === "auth/popup-closed-by-user"
    )
      return "Sign-in was cancelled.";
    if (err.code === "auth/email-already-in-use")
      return "An account with this email already exists. Try signing in instead.";
    if (err.code === "auth/invalid-email") return "Invalid email address.";
    if (err.code === "auth/weak-password")
      return "Password is too weak. Use at least 6 characters.";
    if (
      err.code === "auth/invalid-credential" ||
      err.code === "auth/wrong-password"
    )
      return "Incorrect email or password.";
    if (err.code === "auth/user-not-found")
      return "No account found with this email.";
    return err.message || "Something went wrong.";
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signin") {
        await login(email, password);
        return;
      }

      if (!name.trim()) throw new Error("Name is required.");

      // Validate the code BEFORE creating the account — createUserWithEmailAndPassword
      // signs the user in immediately, and App.jsx (the only place allowed to
      // grant access) does the actual redemption once that sign-in lands.
      const code = accessCode.trim();
      await validateAccessCode(code);
      setPendingSignupCode(code);
      await register(email, password, name.trim());
    } catch (err) {
      console.error("Auth error:", err);
      const message = friendlyAuthError(err);
      setError(message);
      if (onError) onError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // In Create Account mode, confirm the code is claimable BEFORE opening
      // the Google popup — App.jsx redeems it once sign-in actually succeeds.
      if (mode === "register") {
        const code = accessCode.trim();
        await validateAccessCode(code);
        setPendingSignupCode(code);
      }

      await googleLogin();
    } catch (err) {
      console.error("Google sign-in error:", err);
      const message = friendlyAuthError(err);
      setError(message);
      if (onError) onError(message);
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || verifying;

  return (
    <div className="login-shell">
      <div className="login-card">
        <img
          src={logo1}
          alt="STP Badminton Queue"
          className="login-logo"
          style={{width: 300, marginBottom: 0}}
        />
        <h1 className="login-title">Badminton Queue</h1>
        <div className="login-sub">
          Skill-based matching · live courts · payment tracking
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleEmailSubmit} style={{ width: "100%" }}>
          {mode === "register" && (
            <div className="login-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={busy}
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              disabled={busy}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={busy}
            />
          </div>

          {mode === "register" && (
            <div className="login-field">
              <label htmlFor="access-code">Access code</label>
              <input
                id="access-code"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="e.g. STP-XXXX-XXXX"
                disabled={busy}
                autoCapitalize="characters"
              />
            </div>
          )}

          <button
            type="submit"
            className="google-btn"
            disabled={busy}
            style={{ background: "var(--shuttle)", color: "var(--court-dark)" }}
          >
            {verifying
              ? "Verifying…"
              : loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
          </button>
        </form>

        <div className="login-footnote" style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--shuttle)",
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            {mode === "signin"
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="login-divider">
          <span />
          <span className="login-divider-label">or</span>
          <span />
        </div>

        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={busy}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.5 34.9 26.9 36 24 36c-5.3 0-9.8-3.3-11.4-8l-6.5 5C9.4 39.6 16.1 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.1-5.4 6.6l6.5 5.4C39.9 37.1 44 31.3 44 24c0-1.3-.1-2.7-.4-3.5z"
            />
          </svg>
          {verifying
            ? "Verifying…"
            : loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in with Google"
                : "Sign up with Google"}
        </button>

        <div className="login-footnote">
          {mode === "signin"
            ? "Only existing members can sign in with Google"
            : "Signing up with Google also requires the access code above"}
        </div>
      </div>
    </div>
  );
}
