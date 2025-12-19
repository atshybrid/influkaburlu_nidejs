"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { setAccessToken } from "@/lib/storage";

type AuthResponse = {
  accessToken?: string;
  token?: string;
  user?: { id: number; role?: string };
};

type AuthLoginRequest =
  | { email: string; password?: string; mpin?: string }
  | { phone: string; password?: string; mpin?: string };

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [useMpin, setUseMpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifierIsEmail = useMemo(() => identifier.includes("@"), [identifier]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) return setError("Email or phone is required");
    if (!secret) return setError(useMpin ? "MPIN is required" : "Password is required");

    const body: AuthLoginRequest = identifierIsEmail
      ? { email: trimmedIdentifier }
      : { phone: trimmedIdentifier };

    if (useMpin) body.mpin = secret;
    else body.password = secret;

    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      });

      const token = res.accessToken || res.token;
      if (!token) throw new Error("Login succeeded but no token returned");
      setAccessToken(token);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>PR Login</h1>
      <p style={{ marginBottom: 16 }}>
        Use your PR account email/phone + password (or MPIN).
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email or phone</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="test@example.com or 8888888888"
            autoComplete="username"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>{useMpin ? "MPIN" : "Password"}</span>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={useMpin ? "123456" : "your-password"}
            type={useMpin ? "password" : "password"}
            autoComplete={useMpin ? "one-time-code" : "current-password"}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={useMpin}
            onChange={(e) => setUseMpin(e.target.checked)}
          />
          Use MPIN
        </label>

        {error ? (
          <div style={{ color: "crimson" }}>{error}</div>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
        Note: this app proxies <code>/api/*</code> to your backend via Next.js
        rewrites.
      </p>
    </main>
  );
}
