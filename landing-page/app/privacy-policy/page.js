"use client";
import React from "react";
import NextLayout from "@/layouts/NextLayout";
import Breadcrumb from "@/components/Breadcrumb";
import { useSettings } from "@/components/SettingsProvider";

export default function PrivacyPolicy() {
  const { settings } = useSettings();
  const agencySettings = settings || {};
  const agencyName = agencySettings.agencyName || "Hirdan Marketing";
  const contactEmail = agencySettings.adminEmail || "info@hirdanmarketing.com";
  const address = agencySettings.address || "Cite Barwaqo, Republic of Djibouti";
  const phone = agencySettings.phone || "+253 77 64 61 59";
  const cleanPhone = phone ? phone.replace(/\s+/g, '') : '';
  const isDevMode = agencySettings.developmentMode;

  const renderContent = () => (
    <>
      <p>
        At {agencyName}, we commit to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you visit our website and use our digital services, including our client management tools, project portals, and social media scheduling platform.
      </p>
      <p>
        Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site or utilize our services.
      </p>

      <h3>1. Information We Collect</h3>
      <p>
        We collect information about you in a variety of ways. The information we may collect on the site and through our services includes:
      </p>
      <ul>
        <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, shipping/billing address, email address, telephone number, and company name that you voluntarily give to us when you register or sign up for services.</li>
        <li><strong>Financial Data:</strong> Financial information related to your payment method (such as valid credit card number, card brand, expiration date) that we may collect when you purchase, order, return, exchange, or request information about our services. Most financial transaction data is processed directly by our secure third-party payment processors.</li>
        <li><strong>Social Media Credentials & Data:</strong> If you connect your social media profiles (such as Meta/Facebook/Instagram, LinkedIn, YouTube, TikTok, Pinterest, X, or Threads) to our platform, we collect and store authorization tokens (OAuth tokens), profile names, page/account IDs, avatars, and engagement data needed to publish and analyze posts on your behalf.</li>
        <li><strong>Log and Usage Data:</strong> Technical information that our servers automatically collect when you access our platform, including your IP address, browser type, operating system, access times, and the pages you have viewed.</li>
      </ul>

      <h3>2. How We Use Your Information</h3>
      <p>
        Having accurate information about you allows us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you to:
      </p>
      <ul>
        <li>Create and manage your user and client accounts.</li>
        <li>Process payments, subscriptions, invoices, and refunds.</li>
        <li>Provide, operate, and maintain our social media scheduling, posting, and analytic tools.</li>
        <li>Deliver custom marketing deliverables and manage project collaborations.</li>
        <li>Send you administrative information, invoices, updates, and security alerts.</li>
        <li>Respond to client support requests and improve our platform features.</li>
        <li>Perform analysis and compile aggregate data to understand user interaction and optimize services.</li>
      </ul>

      <h3>3. Data Sharing & Third-Party Platforms</h3>
      <p>
        We do not sell, trade, or rent your personal information to third parties. We may share information with third parties in the following situations:
      </p>
      <ul>
        <li><strong>Social Media Platforms API Integrations:</strong> To provide our social scheduling and analytics services, our application integrates directly with third-party APIs (such as Meta Graph API, LinkedIn API, YouTube Data API, TikTok API, Pinterest API, X API, and Threads API). We share only the content, assets, and scheduling instructions that you explicitly direct us to publish.</li>
        <li><strong>Service Providers:</strong> We may share your information with third-party vendors who perform services for us or on our behalf, including database hosting, payment processing, email delivery, and customer support.</li>
        <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal processes, to investigate potential violations of our policies, or to protect the rights, property, and safety of others.</li>
      </ul>

      <h3>4. Third-Party Privacy Policies</h3>
      <p>
        Our platform connects to third-party services. Our Privacy Policy does not apply to other platforms or websites. We advise you to consult the respective Privacy Policies of these third-party platforms (e.g., Google/YouTube API Services, Meta Developer Policies) for more detailed information on their practices and instructions on how to opt-out of certain features.
      </p>

      <h3>5. Cookies and Tracking Technologies</h3>
      <p>
        We may use cookies, web beacons, tracking pixels, and other tracking technologies on the site and services to help customize our platform and improve your experience. Most browsers are set to accept cookies by default. You can remove or reject cookies, but be aware that such action could affect the availability and functionality of our services.
      </p>

      <h3>6. Security of Your Information</h3>
      <p>
        We use administrative, technical, and physical security measures to help protect your personal information and social media access tokens. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
      </p>

      <h3>7. Your Rights & Access to Data</h3>
      <p>
        Depending on your location, you may have the right to:
      </p>
      <ul>
        <li>Request access to and receive a copy of the personal information we hold about you.</li>
        <li>Request rectification of incorrect personal details or complete missing information.</li>
        <li>Request deletion of your account and personal data from our systems.</li>
        <li>Revoke authorization tokens and access permissions for connected social media accounts at any time through the platform settings or via the security settings of the respective social network.</li>
      </ul>

      <h3>8. Contact Us</h3>
      <p>
        If you have questions or comments about this Privacy Policy, please contact us at:
      </p>
      <ul className="contact-details-list">
        <li><strong>Agency Name:</strong> {agencyName}</li>
        <li><strong>Email:</strong> <a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
        {address && <li><strong>Address:</strong> {address}</li>}
        {phone && <li><strong>Phone:</strong> <a href={`tel:${cleanPhone}`}>{phone}</a></li>}
      </ul>
    </>
  );

  // Case 2: Development / Coming Soon Mode - Clean, self-contained layout using brand colors
  if (isDevMode) {
    return (
      <div className="dev-legal-wrapper">
        <div className="coming-soon-bg-glow"></div>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="dev-legal-card">
                <h2>Privacy Policy</h2>
                <p className="last-updated">Last Updated: July 18, 2026</p>
                <hr />
                <div className="legal-content">
                  {renderContent()}
                </div>
                <div className="dev-legal-footer">
                  <a href="/">Back to Coming Soon</a>
                  <span className="separator">•</span>
                  <a href="/terms-of-service">Terms of Service</a>
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
      <Breadcrumb pageName="Privacy Policy" pageTitle="Privacy Policy" />
      
      <section className="legal-section section-padding">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="public-legal-content">
                <h2>Privacy Policy</h2>
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
