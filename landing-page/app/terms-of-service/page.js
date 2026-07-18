"use client";
import React from "react";
import NextLayout from "@/layouts/NextLayout";
import Breadcrumb from "@/components/Breadcrumb";
import { useSettings } from "@/components/SettingsProvider";

export default function TermsOfService() {
  const { settings, isLoading } = useSettings();
  const agencySettings = settings || {};
  const agencyName = agencySettings.agencyName || "Hirdan Marketing";
  const contactEmail = agencySettings.adminEmail || "info@hirdanmarketing.com";
  const address = agencySettings.address || "Cite Barwaqo, Republic of Djibouti";
  const phone = agencySettings.phone || "+253 77 64 61 59";
  const cleanPhone = phone ? phone.replace(/\s+/g, '') : '';
  // Wait until settings are resolved to pick the right layout
  const isDevMode = settings ? agencySettings.developmentMode : undefined;

  const renderContent = () => (
    <>
      <p>
        Welcome to {agencyName}. Please read these Terms of Service ("Terms", "Terms of Service") carefully before using our website and digital services (collectively, the "Services") operated by {agencyName} ("us", "we", or "our").
      </p>
      <p>
        Your access to and use of the Services is conditioned upon your acceptance of and compliance with these Terms. These Terms apply to all visitors, clients, users, and others who access or use our Services. By accessing or using the Services, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access our Services.
      </p>

      <h3>1. Scope of Services</h3>
      <p>
        {agencyName} provides a suite of digital marketing, consulting, branding, content creation, social media management, and software tools, including our project portals, social scheduler, client portals, and invoice tracking features. We reserve the right to modify, suspend, or discontinue any aspect of our Services at any time without notice.
      </p>

      <h3>2. Client & User Accounts</h3>
      <p>
        To access certain features of our platform (such as the Client Portal), you must register and create an account. You agree to:
      </p>
      <ul>
        <li>Provide accurate, current, and complete information during registration.</li>
        <li>Maintain the security of your password and credentials.</li>
        <li>Promptly notify us if you discover or suspect any security breaches related to your account.</li>
        <li>Accept full responsibility for all activities that occur under your account.</li>
      </ul>

      <h3>3. Social Media & Third-Party Integration</h3>
      <p>
        Our services allow you to schedule, publish, and analyze content on various third-party social media platforms (including but not limited to Meta/Facebook/Instagram, LinkedIn, YouTube, TikTok, Pinterest, X, and Threads).
      </p>
      <p>
        By connecting your social media accounts through our platform, you acknowledge and agree that:
      </p>
      <ul>
        <li>You grant us permission to access, store, and publish content to your connected accounts on your behalf, in accordance with your instructions.</li>
        <li>You are solely responsible for ensuring your content complies with the terms of service, developer policies, and community guidelines of each respective social media platform.</li>
        <li>We are not responsible or liable for any suspension, restriction, or termination of your social media accounts by third-party platforms due to the content you publish.</li>
      </ul>

      <h3>4. Intellectual Property Rights</h3>
      <p>
        Unless otherwise agreed in a separate written agreement (such as a Service Agreement), the following terms apply:
      </p>
      <ul>
        <li><strong>Agency Materials:</strong> All software, designs, methodologies, templates, algorithms, and technology used to deliver our Services remain the exclusive property of {agencyName}.</li>
        <li><strong>Deliverables:</strong> Upon receipt of full payment, clients are granted ownership and a perpetual, worldwide license to use the custom marketing assets and deliverables created specifically for them.</li>
        <li><strong>Client Content:</strong> You retain all rights to any content, media, or data you upload to our platform. You grant us a limited license to host, parse, and publish this content solely to perform the Services.</li>
      </ul>

      <h3>5. Fees, Subscriptions & Payments</h3>
      <p>
        Clients agree to pay all fees associated with their selected service packages, projects, or subscriptions as specified in our invoices or client portals.
      </p>
      <ul>
        <li><strong>Invoicing:</strong> Invoices are due upon receipt or within the timeframe specified on the invoice. Late payments may result in the suspension of Services.</li>
        <li><strong>Subscriptions:</strong> Subscription services are billed in advance on a recurring monthly or annual basis. You may cancel your subscription at any time; however, cancellations will take effect at the end of the current billing cycle, and no refunds will be issued for partial periods.</li>
        <li><strong>Taxes:</strong> All fees are exclusive of applicable taxes unless stated otherwise.</li>
      </ul>

      <h3>6. Acceptable Use Policy</h3>
      <p>
        You agree not to use our Services for any unlawful purpose or to publish content that is defamatory, offensive, misleading, or violates the intellectual property or privacy rights of any third party. We reserve the right to terminate accounts that violate this policy.
      </p>

      <h3>7. Limitation of Liability</h3>
      <p>
        In no event shall {agencyName}, its directors, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your use or inability to use the Services; (ii) any unauthorized access to or use of our servers or connected accounts; or (iii) any actions taken by third-party platforms.
      </p>

      <h3>8. Governing Law</h3>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which {agencyName} is registered, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
      </p>

      <h3>9. Contact Us</h3>
      <p>
        If you have any questions about these Terms, please contact us at:
      </p>
      <ul className="contact-details-list">
        <li><strong>Agency Name:</strong> {agencyName}</li>
        <li><strong>Email:</strong> <a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
        {address && <li><strong>Address:</strong> {address}</li>}
        {phone && <li><strong>Phone:</strong> <a href={`tel:${cleanPhone}`}>{phone}</a></li>}
      </ul>
    </>
  );

  // While settings are loading, show a minimal centered spinner — prevents layout flash
  if (isLoading && settings === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f8f8" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e0e0e0", borderTopColor: "#504289", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  // Case 2: Development / Coming Soon Mode - Clean, self-contained layout using brand colors
  if (isDevMode) {
    return (
      <div className="dev-legal-wrapper">
        <div className="coming-soon-bg-glow"></div>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="dev-legal-card">
                <h2>Terms of Service</h2>
                <p className="last-updated">Last Updated: July 18, 2026</p>
                <hr />
                <div className="legal-content">
                  {renderContent()}
                </div>
                <div className="dev-legal-footer">
                  <a href="/">Back to Coming Soon</a>
                  <span className="separator">•</span>
                  <a href="/privacy-policy">Privacy Policy</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            background-color: #f8f8f8 !important;
            margin: 0;
            padding: 0;
          }
          .dev-legal-wrapper {
            min-height: 100vh;
            width: 100%;
            background-color: #f8f8f8;
            color: #333333;
            position: relative;
            overflow-y: auto;
            font-family: 'Inter', sans-serif;
            padding: 4rem 2rem;
          }
          .coming-soon-bg-glow {
            position: fixed;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle at 35% 35%, rgba(80, 66, 137, 0.08) 0%, transparent 60%),
                        radial-gradient(circle at 65% 65%, rgba(245, 178, 26, 0.06) 0%, transparent 60%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
            pointer-events: none;
          }
          .dev-legal-card {
            position: relative;
            z-index: 2;
            background: #ffffff;
            border: 1px solid rgba(80, 66, 137, 0.08);
            border-radius: 16px;
            padding: 3.5rem;
            box-shadow: 0 15px 35px rgba(80, 66, 137, 0.06), 0 5px 15px rgba(0, 0, 0, 0.02);
            backdrop-filter: blur(10px);
          }
          .dev-legal-card h2 {
            font-size: 2.25rem;
            font-weight: 800;
            color: #504289;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
          }
          .dev-legal-card h3 {
            font-size: 1.35rem;
            font-weight: 700;
            color: #504289;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
          }
          .dev-legal-card p {
            color: #555555;
            font-size: 15px;
            line-height: 1.75;
            margin-bottom: 1.25rem;
          }
          .dev-legal-card ul {
            list-style-type: none;
            padding-left: 0;
            margin-bottom: 1.5rem;
          }
          .dev-legal-card ul li {
            position: relative;
            padding-left: 20px;
            color: #555555;
            margin-bottom: 0.5rem;
            font-size: 15px;
            line-height: 1.75;
          }
          .dev-legal-card ul li::before {
            content: "•";
            color: #f5b21a;
            font-size: 20px;
            position: absolute;
            left: 4px;
            top: -2px;
          }
          .dev-legal-card .contact-details-list li::before {
            content: "";
          }
          .dev-legal-card .contact-details-list li {
            padding-left: 0;
          }
          .dev-legal-card a {
            color: #504289;
            text-decoration: none;
            transition: color 0.2s ease;
            font-weight: 500;
          }
          .dev-legal-card a:hover {
            color: #f5b21a;
          }
          .dev-legal-card hr {
            border-top: 1px solid rgba(80, 66, 137, 0.08);
            margin: 1.5rem 0 2rem 0;
          }
          .dev-legal-footer {
            margin-top: 3.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1.5rem;
            font-size: 14px;
            border-top: 1px solid rgba(80, 66, 137, 0.08);
            padding-top: 2rem;
          }
          .dev-legal-footer a {
            color: #504289;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
          }
          .dev-legal-footer a:hover {
            color: #f5b21a;
          }
          .dev-legal-footer .separator {
            color: rgba(255, 255, 255, 0.15);
          }
          @media (max-width: 768px) {
            .dev-legal-card {
              padding: 2.5rem 1.5rem;
            }
          }
        `}} />
      </div>
    );
  }

  // Case 1: Public Mode - Render under the theme's layout using brand colors
  return (
    <NextLayout>
      <Breadcrumb pageName="Terms of Service" pageTitle="Terms of Service" />
      
      <section className="legal-section section-padding">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="public-legal-content">
                <h2>Terms of Service</h2>
                <p className="last-updated">Last Updated: July 18, 2026</p>
                <div className="legal-content-body">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .public-legal-content {
          font-family: 'Inter', sans-serif;
          line-height: 1.8;
          color: #4b5563;
        }
        .public-legal-content h2 {
          font-size: 2.5rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .public-legal-content h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }
        .public-legal-content p {
          color: #4b5563;
          font-size: 16px;
          margin-bottom: 1.5rem;
        }
        .public-legal-content ul {
          list-style-type: none;
          padding-left: 0;
          margin-bottom: 1.5rem;
        }
        .public-legal-content ul li {
          position: relative;
          padding-left: 20px;
          color: #4b5563;
          margin-bottom: 0.5rem;
          font-size: 16px;
        }
        .public-legal-content ul li::before {
          content: "•";
          color: var(--theme);
          font-size: 20px;
          position: absolute;
          left: 4px;
          top: -2px;
        }
        .public-legal-content .contact-details-list li::before {
          content: "";
        }
        .public-legal-content .contact-details-list li {
          padding-left: 0;
        }
        .public-legal-content a {
          color: var(--theme);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .public-legal-content a:hover {
          color: var(--theme-2);
        }
        .last-updated {
          color: var(--theme);
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 1.5rem;
        }
      ` }} />
    </NextLayout>
  );
}
