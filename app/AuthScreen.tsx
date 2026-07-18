"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type AuthMode = "login" | "signup";

type AuthScreenProps = {
  mode: AuthMode;
};

type FieldLabelProps = {
  children: ReactNode;
};

type Message = {
  type: "error" | "success";
  text: string;
};

type AuthResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
};

const loginErrors: Record<string, string> = {
  invalid: "Email or password is incorrect.",
};

const signupErrors: Record<string, string> = {
  name: "Enter your full name.",
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters.",
  confirm: "Passwords do not match.",
  exists: "An account already exists for that email.",
};

function getErrorMessage(mode: AuthMode, error?: string) {
  if (!error) {
    return "";
  }

  if (mode === "login") {
    return loginErrors[error] ?? loginErrors.invalid;
  }

  return signupErrors[error] ?? signupErrors.email;
}

function FieldLabel({ children }: FieldLabelProps) {
  return (
    <span className="field-label">
      {children}
      <span className="required-mark" aria-hidden="true">
        *
      </span>
    </span>
  );
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  function closeMessage() {
    setMessage(null);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(isLogin ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || data.error) {
        setMessage({
          type: "error",
          text: getErrorMessage(mode, data.error) || "Something went wrong. Please try again.",
        });
        return;
      }

      if (isLogin) {
        router.push(data.redirectTo ?? "/dashboard");
        return;
      }

      setMessage({
        type: "success",
        text: data.message ?? "Account created successfully. Redirecting to login...",
      });
      form.reset();
      redirectTimer.current = setTimeout(() => {
        router.push(data.redirectTo ?? "/login");
      }, 5000);
    } catch {
      setMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="welcome-page">
      {isLoading ? (
        <div className="full-page-loader" role="status" aria-live="assertive">
          <div className="loader-ring" />
          <p>{isLogin ? "Logging in..." : "Creating account..."}</p>
        </div>
      ) : null}

      <section className="welcome-panel">
        <div className="shape shape-large" />
        <div className="shape shape-small" />
        <div className="dot-grid" />
        <div className="welcome-copy">
          <p className="eyebrow light">Revenue reconciliation</p>
          <h1>Welcome to PayMatch</h1>
          <p>Import orders and payments, find mismatches, and focus on the money that needs attention.</p>
        </div>
      </section>

      <section className="welcome-auth">
        <div className="auth-panel">
          <p className="eyebrow">{isLogin ? "Welcome back" : "Create account"}</p>
          <h1>{isLogin ? "Log in" : "Sign up"}</h1>

          <div className="form-message-slot" aria-live="polite">
            {message ? (
              <div className={`form-message ${message.type}`}>
                <p>{message.text}</p>
                <button type="button" aria-label="Close message" onClick={closeMessage}>
                  x
                </button>
              </div>
            ) : null}
          </div>

          <form
            action={isLogin ? "/api/auth/login" : "/api/auth/signup"}
            method="post"
            className="auth-form"
            onSubmit={submitAuth}
          >
            {!isLogin ? (
              <label>
                <FieldLabel>Full name</FieldLabel>
                <input
                  name="fullName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  pattern="[^<>]+"
                  title="Enter your name without angle brackets."
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label>
              <FieldLabel>Email</FieldLabel>
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label>
              <FieldLabel>Password</FieldLabel>
              <input
                name="password"
                type="password"
                required
                minLength={isLogin ? undefined : 8}
                maxLength={128}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </label>
            {!isLogin ? (
              <label>
                <FieldLabel>Confirm password</FieldLabel>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            ) : null}
            <button type="submit">{isLogin ? "Log in" : "Create account"}</button>
          </form>

          <p className="auth-switch">
            {isLogin ? "Do not have an account? " : "Already have an account? "}
            <Link href={isLogin ? "/signup" : "/login"}>
              {isLogin ? "Create account" : "Log in"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
