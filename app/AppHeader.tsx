"use client";

import Link from "next/link";
import { useState } from "react";

type AppHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  user: {
    email: string;
    fullName?: string | null;
  };
  activePage?: "dashboard" | "import";
};

function getInitials(name: string, email: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

export function AppHeader({ eyebrow, title, subtitle, user, activePage }: AppHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayName = user.fullName?.trim() || user.email.split("@")[0];
  const initials = getInitials(displayName, user.email);

  return (
    <header className="app-header site-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>

      <nav className="app-nav" aria-label="Main navigation">
        <Link className={activePage === "dashboard" ? "nav-active" : ""} href="/dashboard">
          Dashboard
        </Link>
        <Link className={activePage === "import" ? "nav-active" : ""} href="/import">
          Import
        </Link>

        <div className="profile-menu">
          <button
            type="button"
            className="profile-button"
            aria-expanded={isOpen}
            aria-haspopup="menu"
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="profile-avatar">{initials}</span>
            <span className="profile-name">{displayName}</span>
          </button>

          {isOpen ? (
            <div className="profile-dropdown" role="menu">
              <div className="profile-summary">
                <span className="profile-avatar large">{initials}</span>
                <div>
                  <strong>{displayName}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="secondary-button">
                  Log out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
