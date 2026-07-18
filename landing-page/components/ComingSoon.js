"use client";
import React, { useState, useEffect } from "react";
import { useSettings } from "./SettingsProvider";

export default function ComingSoon() {
  const { settings, landingPageContent, apiBaseUrl, resolveImageUrl } = useSettings();
  const agencyName = settings?.agencyName || "Hirdan Marketing";
  const logoUrl = settings?.logo || settings?.whiteLogo;
  const message =
    settings?.comingSoonMessage ||
    "We're crafting something extraordinary. Our new digital experience is almost ready.";
  const socialLinks = settings?.socialLinks || {};

  // Form submission state
  const [email, setEmail] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Countdown timer to settings launch date or default 30 days
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    let targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    if (settings?.comingSoonCountdown) {
      const parsedDate = new Date(settings.comingSoonCountdown);
      if (!isNaN(parsedDate.getTime())) {
        targetDate = parsedDate;
      }
    }

    const tick = () => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [settings?.comingSoonCountdown]);

  const handleNotify = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatusMsg("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setStatusMsg("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setStatusMsg(data.message || "Thank you! We will notify you when we launch.");
        setEmail("");
      } else {
        setStatusMsg(data.message || data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setStatusMsg("Could not connect to the server. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pads = (n) => String(n).padStart(2, "0");

  const bullets = settings?.comingSoonBullets
    ? settings.comingSoonBullets.split(",").map(b => b.trim()).filter(Boolean)
    : landingPageContent?.aboutBullets
    ? landingPageContent.aboutBullets.split(",").map(b => b.trim()).filter(Boolean)
    : [
        "Full-Service Digital Marketing",
        "Data-Driven Strategy",
        "Premium Brand Identity",
        "Targeted Campaign Management"
      ];

  return (
    <div className="cs-wrapper">
      {/* Decorative background elements */}
      <div className="cs-bg-layer">
        <div className="cs-orb cs-orb-1" />
        <div className="cs-orb cs-orb-2" />
        <div className="cs-grid" />
        <div className="cs-noise" />
      </div>

      {/* Top bar */}
      <header className="cs-topbar">
        <div className="cs-topbar-logo">
          {logoUrl ? (
            <img src={resolveImageUrl(logoUrl)} alt={agencyName} />
          ) : (
            <span className="cs-brand-name">{agencyName}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="cs-main">
        {/* Left column — text content */}
        <div className="cs-left">
          <div className="cs-badge">
            <span className="cs-badge-dot" />
            <span>Something big is coming</span>
          </div>

          <h1 className="cs-title">
            We&rsquo;re building your <br />
            <span className="cs-title-accent">next-level</span> digital<br />
            presence
          </h1>

          <p className="cs-desc">{message}</p>

          {/* Email notify */}
          <form onSubmit={handleNotify} className="cs-notify-row">
            <input
              type="email"
              className="cs-email-input"
              placeholder="Enter your email for early access"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <button type="submit" className="cs-notify-btn" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Notify Me"}
            </button>
          </form>
          {statusMsg && (
            <p className="cs-status-msg">
              {statusMsg}
            </p>
          )}

          {/* Social links */}
          {Array.isArray(socialLinks) && socialLinks.filter((s) => s.url).length > 0 && (
            <div className="cs-socials">
              <span className="cs-socials-label">Follow us</span>
              <div className="cs-socials-icons">
                {socialLinks
                  .filter((s) => s.url)
                  .map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.platform}
                    >
                      <i className={`${s.icon === "fa-globe" ? "fas" : "fab"} ${s.icon}`} />
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — countdown card */}
        <div className="cs-right">
          <div className="cs-card">
            <div className="cs-card-eyebrow">Launch Countdown</div>
            <div className="cs-countdown">
              <div className="cs-unit">
                <div className="cs-unit-number">{pads(timeLeft.days)}</div>
                <div className="cs-unit-label">Days</div>
              </div>
              <div className="cs-colon">:</div>
              <div className="cs-unit">
                <div className="cs-unit-number">{pads(timeLeft.hours)}</div>
                <div className="cs-unit-label">Hours</div>
              </div>
              <div className="cs-colon">:</div>
              <div className="cs-unit">
                <div className="cs-unit-number">{pads(timeLeft.minutes)}</div>
                <div className="cs-unit-label">Min</div>
              </div>
              <div className="cs-colon">:</div>
              <div className="cs-unit">
                <div className="cs-unit-number">{pads(timeLeft.seconds)}</div>
                <div className="cs-unit-label">Sec</div>
              </div>
            </div>

            <div className="cs-divider" />

            <div className="cs-features">
              {bullets.map((bullet, idx) => (
                <div className="cs-feature-item" key={idx}>
                  <span className="cs-feature-icon"><i className="fas fa-check" /></span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            <a
              href="https://app.hirdanmarketing.com/login"
              className="cs-portal-btn"
            >
              <i className="fas fa-user-circle" /> Access Client Portal
            </a>
          </div>
        </div>
      </main>

      {/* Bottom footer */}
      <footer className="cs-footer">
        <span>© {new Date().getFullYear()} {agencyName}. All rights reserved.</span>
        <div className="cs-footer-links">
          <a href="/terms-of-service">Terms of Service</a>
          <span className="cs-sep">·</span>
          <a href="/privacy-policy">Privacy Policy</a>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background-color: #f8f8f8 !important;
          margin: 0;
          padding: 0;
        }

        .cs-wrapper {
          min-height: 100vh;
          width: 100%;
          background-color: #f8f8f8;
          color: #333333;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* ── Background ── */
        .cs-bg-layer {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .cs-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
        }
        .cs-orb-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(80, 66, 137, 0.08) 0%, transparent 70%);
          top: -150px;
          right: -100px;
        }
        .cs-orb-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(245, 178, 26, 0.06) 0%, transparent 70%);
          bottom: -100px;
          left: -80px;
        }
        .cs-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(80, 66, 137, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(80, 66, 137, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .cs-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.02'/%3E%3C/svg%3E");
          opacity: 0.3;
        }

        /* ── Topbar ── */
        .cs-topbar {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 3rem;
          border-bottom: 1px solid rgba(80, 66, 137, 0.08);
          backdrop-filter: blur(10px);
          background: rgba(248, 248, 248, 0.6);
        }
        .cs-topbar-logo img {
          max-height: 70px;
          object-fit: contain;
        }
        .cs-brand-name {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #504289;
        }

        /* ── Main Layout ── */
        .cs-main {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 4rem;
          padding: 4rem 3rem;
          max-width: 1300px;
          margin: 0 auto;
          width: 100%;
        }
        .cs-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: cs-fade-up 0.9s ease-out both;
        }
        .cs-right {
          flex: 0 0 420px;
          animation: cs-fade-up 0.9s 0.2s ease-out both;
        }

        /* ── Badge ── */
        .cs-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(80, 66, 137, 0.06);
          border: 1px solid rgba(80, 66, 137, 0.15);
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #504289;
          margin-bottom: 2rem;
          width: fit-content;
        }
        .cs-badge-dot {
          width: 7px;
          height: 7px;
          background: #f5b21a;
          border-radius: 50%;
          box-shadow: 0 0 8px #f5b21a;
          animation: cs-pulse 2s infinite;
        }

        /* ── Title ── */
        .cs-title {
          font-size: clamp(2.5rem, 5vw, 3.75rem);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -0.03em;
          margin-bottom: 1.75rem;
          color: #504289;
        }
        .cs-title-accent {
          color: #f5b21a;
        }

        /* ── Description ── */
        .cs-desc {
          font-size: 1.1rem;
          color: #555555;
          line-height: 1.7;
          margin-bottom: 2.5rem;
          max-width: 500px;
        }

        /* ── Email notify row ── */
        .cs-notify-row {
          display: flex;
          gap: 0;
          margin-bottom: 0.5rem;
          max-width: 480px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(80, 66, 137, 0.15);
          background: #ffffff;
        }
        .cs-email-input {
          flex: 1;
          padding: 14px 18px;
          background: transparent;
          border: none;
          color: #333333;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          outline: none;
        }
        .cs-email-input::placeholder { color: #888888; }
        .cs-notify-btn {
          padding: 14px 22px;
          background: #504289;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          border: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.25s ease;
          white-space: nowrap;
        }
        .cs-notify-btn:hover { background: #3e3270; }

        .cs-status-msg {
          font-size: 14px;
          margin-top: 0.5rem;
          margin-bottom: 2rem;
          text-align: left;
          font-weight: 600;
          color: #504289;
        }

        /* ── Socials ── */
        .cs-socials {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .cs-socials-label {
          font-size: 13px;
          color: #777777;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .cs-socials-icons {
          display: flex;
          gap: 0.75rem;
        }
        .cs-socials-icons a {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid rgba(80, 66, 137, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #504289;
          text-decoration: none;
          font-size: 14px;
          transition: all 0.25s ease;
          background: #ffffff;
        }
        .cs-socials-icons a:hover {
          background: #f5b21a;
          color: #ffffff;
          border-color: #f5b21a;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(245, 178, 26, 0.25);
        }

        /* ── Card ── */
        .cs-card {
          background: #ffffff;
          border: 1px solid rgba(80, 66, 137, 0.08);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 15px 35px rgba(80, 66, 137, 0.06), 0 5px 15px rgba(0, 0, 0, 0.02);
        }
        .cs-card-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #888888;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }

        /* ── Countdown ── */
        .cs-countdown {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2rem;
        }
        .cs-unit {
          flex: 1;
          text-align: center;
          background: rgba(80, 66, 137, 0.03);
          border: 1px solid rgba(80, 66, 137, 0.08);
          border-radius: 12px;
          padding: 1rem 0.5rem;
        }
        .cs-unit-number {
          font-size: 2.25rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #504289;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .cs-unit-label {
          font-size: 10px;
          color: #777777;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
          margin-top: 6px;
        }
        .cs-colon {
          font-size: 1.75rem;
          font-weight: 900;
          color: #f5b21a;
          padding-bottom: 1rem;
          flex-shrink: 0;
        }

        /* ── Divider ── */
        .cs-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(80, 66, 137, 0.08), transparent);
          margin: 0 0 1.75rem 0;
        }

        /* ── Features ── */
        .cs-features {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          margin-bottom: 2rem;
        }
        .cs-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #555555;
          font-weight: 500;
          text-align: left;
        }
        .cs-feature-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(245, 178, 26, 0.12);
          border: 1px solid rgba(245, 178, 26, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5b21a;
          font-size: 11px;
          flex-shrink: 0;
        }

        /* ── Portal Button ── */
        .cs-portal-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #504289 0%, #3e3270 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 15px;
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.25s ease;
          box-shadow: 0 4px 15px rgba(80, 66, 137, 0.15);
        }
        .cs-portal-btn:hover {
          background: linear-gradient(135deg, #3e3270 0%, #2e2456 100%);
          box-shadow: 0 6px 20px rgba(80, 66, 137, 0.25);
          transform: translateY(-2px);
        }

        /* ── Footer ── */
        .cs-footer {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 3rem;
          border-top: 1px solid rgba(80, 66, 137, 0.08);
          font-size: 13px;
          color: #777777;
          background: rgba(248, 248, 248, 0.6);
          backdrop-filter: blur(10px);
        }
        .cs-footer-links {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .cs-footer-links a {
          color: #504289;
          text-decoration: none;
          transition: color 0.2s;
          font-weight: 500;
        }
        .cs-footer-links a:hover { color: #f5b21a; }
        .cs-sep { color: rgba(80, 66, 137, 0.15); }

        /* ── Animations ── */
        @keyframes cs-fade-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cs-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(245, 178, 26, 0.6); }
          70%  { box-shadow: 0 0 0 7px rgba(245, 178, 26, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 178, 26, 0); }
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .cs-main { flex-direction: column; gap: 3rem; padding: 3rem 2rem; }
          .cs-right { flex: none; width: 100%; max-width: 520px; margin: 0 auto; }
          .cs-title { font-size: 2.5rem; }
        }
        @media (max-width: 640px) {
          .cs-topbar { padding: 1.25rem 1.5rem; }
          .cs-main { padding: 2rem 1.5rem; }
          .cs-title { font-size: 2rem; }
          .cs-notify-row { flex-direction: column; border-radius: 10px; overflow: visible; background: none; border: none; gap: 0.75rem; }
          .cs-email-input { border: 1px solid rgba(80, 66, 137, 0.15); border-radius: 10px; background: #ffffff; }
          .cs-notify-btn { border-radius: 10px; }
          .cs-footer { flex-direction: column; gap: 0.5rem; text-align: center; padding: 1.25rem; }
          .cs-countdown { gap: 0.3rem; }
          .cs-unit-number { font-size: 1.75rem; }
          .cs-card { padding: 1.75rem; }
        }
      `}} />
    </div>
  );
}
