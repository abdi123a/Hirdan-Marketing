"use client";
import React from "react";
import { useSettings } from "./SettingsProvider";

export default function ComingSoon() {
  const { settings, resolveImageUrl } = useSettings();
  const agencyName = settings?.agencyName || "Hirdan Marketing";
  const logoUrl = settings?.whiteLogo || settings?.logo;
  const message = settings?.comingSoonMessage || "We're currently working on something amazing. Check back soon!";
  const socialLinks = settings?.socialLinks || {};

  return (
    <div className="coming-soon-wrapper">
      <div className="coming-soon-bg-glow"></div>
      
      <div className="coming-soon-container">
        <div className="coming-soon-content">
          {/* Logo */}
          <div className="coming-soon-logo">
            {logoUrl ? (
              <img src={resolveImageUrl(logoUrl)} alt={agencyName} />
            ) : (
              <h2 className="logo-text">{agencyName}</h2>
            )}
          </div>

          {/* Badge */}
          <span className="coming-soon-badge">
            <span className="badge-dot"></span> Under Construction
          </span>

          {/* Title */}
          <h1 className="coming-soon-title">
            Something Great <br />Is <span>Coming Soon</span>
          </h1>

          {/* Description */}
          <p className="coming-soon-desc">{message}</p>

          {/* Optional: Go to Login / Admin panel for agency employees */}
          <div className="coming-soon-actions">
            <a href="https://app.hirdanmarketing.com/login" className="theme-btn">
              Client Portal <i className="fas fa-long-arrow-right" />
            </a>
          </div>

          {/* Social Links */}
          {Array.isArray(socialLinks) && socialLinks.filter(s => s.url).length > 0 && (
            <div className="coming-soon-socials">
              <p className="socials-title">Follow our journey</p>
              <div className="social-icons">
                {socialLinks.filter(s => s.url).map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.platform}>
                    <i className={`${s.icon === 'fa-globe' ? 'fas' : 'fab'} ${s.icon}`} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .coming-soon-wrapper {
          min-height: 100vh;
          width: 100%;
          background-color: #0b0f19;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          padding: 2rem;
        }

        .coming-soon-bg-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
        }

        .coming-soon-container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 640px;
          text-align: center;
        }

        .coming-soon-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeInUpCS 1s ease-out;
        }

        .coming-soon-logo {
          margin-bottom: 3.5rem;
          max-width: 220px;
        }

        .coming-soon-logo img {
          max-height: 65px;
          object-fit: contain;
        }

        .logo-text {
          font-weight: 800;
          letter-spacing: -0.05em;
          color: #ffffff;
          font-size: 2rem;
        }

        .coming-soon-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 600;
          color: #a5b4fc;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 2rem;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          background-color: #6366f1;
          border-radius: 50%;
          box-shadow: 0 0 10px #6366f1;
          animation: pulseCS 2s infinite;
        }

        .coming-soon-title {
          font-size: 3.25rem;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
          color: #ffffff;
        }

        .coming-soon-title span {
          background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .coming-soon-desc {
          font-size: 1.125rem;
          color: #9ca3af;
          line-height: 1.6;
          margin-bottom: 3rem;
          max-width: 480px;
        }

        .coming-soon-actions {
          margin-bottom: 4rem;
        }

        .coming-soon-socials {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 2rem;
          width: 100%;
        }

        .socials-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #6b7280;
          font-weight: 700;
          margin-bottom: 1.25rem;
        }

        .social-icons {
          display: flex;
          gap: 1.5rem;
          justify-content: center;
        }

        .social-icons a {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #9ca3af;
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .social-icons a:hover {
          background: #6366f1;
          color: #ffffff;
          border-color: #6366f1;
          transform: translateY(-3px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        @keyframes fadeInUpCS {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseCS {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(99, 102, 241, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
          }
        }

        @media (max-width: 640px) {
          .coming-soon-title {
            font-size: 2.25rem;
          }
          .coming-soon-desc {
            font-size: 1rem;
            margin-bottom: 2rem;
          }
          .coming-soon-logo {
            margin-bottom: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
