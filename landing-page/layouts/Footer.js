"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";

// Read cached settings from localStorage to avoid logo flash on initial render
function getInitialCachedSettings() {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem("agency_settings");
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

function useEffectiveSettings() {
  const ctx = useSettings();
  const [cachedSettings, setCachedSettings] = useState(null);

  useEffect(() => {
    const cached = getInitialCachedSettings();
    if (cached) setCachedSettings(cached);
  }, []);

  return { ...ctx, settings: ctx.settings || cachedSettings };
}

const Footer = ({ footer }) => {
  switch (footer) {
    case 1:
      return <Footer1 />;

    case 2:
      return <Footer2 />;

    case 3:
      return <Footer3 />;

    case 4:
      return <Footer4 />;

    case 6:
      return <Footer6 />;

    default:
      return <Footer1 />;
  }
};
export default Footer;

const Footer1 = () => {
  const { settings } = useEffectiveSettings();
  const agencySettings = settings || {};
  const rawSocial = agencySettings.socialLinks;
  let socialArray = [];
  if (Array.isArray(rawSocial)) {
    socialArray = rawSocial.filter(s => s.url);
  } else if (rawSocial && typeof rawSocial === 'object') {
    const iconMap = { facebook: 'fa-facebook-f', twitter: 'fa-twitter', instagram: 'fa-instagram', linkedin: 'fa-linkedin-in' };
    socialArray = Object.entries(rawSocial).filter(([, url]) => url).map(([k, url]) => ({ id: k, platform: k, icon: iconMap[k] || 'fa-globe', url }));
  }
  return (
    <footer className="footer-section footer-bg">
      <div className="container">
        <div className="discussed-items">
          <div className="footer-logo wow fadeInUp" data-wow-delay=".3s">
            <Link href="/">
              <img src="assets/img/logo/white-logo.svg" alt="logo-img" />
            </Link>
          </div>
          <div className="discussed-content wow fadeInUp" data-wow-delay=".5s">
            <h2>
              Let's Discussed About <span>Your Projects</span>
            </h2>
            <Link href="contact" className="theme-btn hover-white">
              Get Started <i className="far fa-arrow-right" />
            </Link>
          </div>
        </div>
        <div className="footer-widgets-wrapper">
          <div className="row">
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".2s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>About Us</h4>
                </div>
                <div className="footer-content">
                  <p>
                    Sed perspiciatis unde omnis natus doloremque laudantium
                    totae
                  </p>
                  <div className="social-icon d-flex align-items-center">
                    {socialArray.map(s => (
                      <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.platform}>
                        <i className={`${s.icon === 'fa-globe' ? 'fas' : 'fab'} ${s.icon}`} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-5 wow fadeInUp"
              data-wow-delay=".4s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Quick Link</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Popular Services</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-1 wow fadeInUp"
              data-wow-delay=".6s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Get In Touch</h4>
                </div>
                <div className="contact-info-area">
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-map-marker-alt" />
                    </div>
                    <div className="content">
                      <p>
                        55 Main Street, 2nd block <br />
                        Malborne, Australia
                      </p>
                    </div>
                  </div>
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-envelope" />
                    </div>
                    <div className="content">
                      <a href="mailto:info@example.com" className="link">
                        info@example.com
                      </a>
                    </div>
                  </div>
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-phone-alt" />
                    </div>
                    <div className="content">
                      <h4>
                        <a href="tel:00012345688">+000 (123) 456 88</a>
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".8s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Recent News</h4>
                </div>
                <div className="recent-post-area">
                  <div className="recent-post-items">
                    <div
                      className="thumb bg-cover"
                      style={{
                        backgroundImage: 'url("assets/img/news/pp1.png")',
                      }}
                    />
                    <div className="content">
                      <ul className="post-date">
                        <li>Nov 25, 2024</li>
                      </ul>
                      <h6>
                        <Link href="news-details">
                          How achieve more <br /> your nine to five
                        </Link>
                      </h6>
                    </div>
                  </div>
                  <div className="recent-post-items mb-0">
                    <div
                      className="thumb bg-cover"
                      style={{
                        backgroundImage: 'url("assets/img/news/pp2.png")',
                      }}
                    />
                    <div className="content">
                      <ul className="post-date">
                        <li>Nov 29, 2024</li>
                      </ul>
                      <h6>
                        <Link href="news-details">
                          Discover a better way of company.
                        </Link>
                      </h6>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container">
            <div className="footer-wrapper d-flex align-items-center justify-content-between">
              <ul className="footer-menu wow fadeInUp" data-wow-delay=".2s">
                <li>
                  <Link href="/terms-of-service">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/privacy-policy">Privacy Policy</Link>
                </li>
              </ul>
              <a
                href="#"
                id="scrollUp"
                className="scroll-icon wow fadeInUp"
                data-wow-delay=".4s"
              >
                <i className="far fa-angle-double-up" />
              </a>
              <p className="wow fadeInUp" data-wow-delay=".6s">
                © <Link href="/">2024</Link> All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Footer2 = () => {
  const { settings } = useEffectiveSettings();
  const agencySettings = settings || {};
  const rawSocial = agencySettings.socialLinks;
  let socialArray = [];
  if (Array.isArray(rawSocial)) {
    socialArray = rawSocial.filter(s => s.url);
  } else if (rawSocial && typeof rawSocial === 'object') {
    const iconMap = { facebook: 'fa-facebook-f', twitter: 'fa-twitter', instagram: 'fa-instagram', linkedin: 'fa-linkedin-in' };
    socialArray = Object.entries(rawSocial).filter(([, url]) => url).map(([k, url]) => ({ id: k, platform: k, icon: iconMap[k] || 'fa-globe', url }));
  }
  return (
    <footer className="footer-section footer-bg">
      <div className="container">
        <div className="footer-widgets-wrapper">
          <div className="row">
            <div
              className="col-xxl-2 col-xl-4 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".2s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <Link href="/">
                    <img src="assets/img/logo/white-logo.svg" alt="logo-img" />
                  </Link>
                </div>
                <div className="footer-content">
                  <p>
                    Sed perspiciatis unde omnis natus doloremque laudantium
                    totae
                  </p>
                  <div className="social-icon d-flex align-items-center">
                    {socialArray.map(s => (
                      <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.platform}>
                        <i className={`${s.icon === 'fa-globe' ? 'fas' : 'fab'} ${s.icon}`} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xxl-3 col-xl-4 col-lg-4 col-md-6 ps-xxl-5 ml-30 wow fadeInUp"
              data-wow-delay=".3s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Quick Link</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Popular Services</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xxl-3 col-xl-4 col-lg-4 col-md-6 ml-minus-30 wow fadeInUp"
              data-wow-delay=".4s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Get In Touch</h4>
                </div>
                <div className="contact-info-area">
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-map-marker-alt" />
                    </div>
                    <div className="content">
                      <p>
                        55 Main Street, 2nd block <br />
                        Malborne, Australia
                      </p>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-envelope" />
                    </div>
                    <div className="content">
                      <a href="mailto:info@example.com" className="link">
                        info@example.com
                      </a>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-phone-alt" />
                    </div>
                    <div className="content">
                      <h4>
                        <a href="tel:00012345688">+000 (123) 456 88</a>
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xxl-2 col-xl-4 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".5s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Support</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Terms &amp; Conditions</Link>
                  </li>
                  <li>
                    <Link href="contact">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link href="pricing">Pricing Plan</Link>
                  </li>
                  <li>
                    <Link href="contact">Contact us</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xxl-2 col-xl-4 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".7s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Product</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Web Template Design</Link>
                  </li>
                  <li>
                    <Link href="service-details">Mobile Application</Link>
                  </li>
                  <li>
                    <Link href="service-details">3D Illustration</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom style-2">
        <div className="container">
          <div className="footer-wrapper d-flex align-items-center justify-content-between pb-0">
            <ul className="footer-menu">
              <li>
                <Link href="/terms-of-service">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
            </ul>
            <a href="#" id="scrollUp" className="scroll-icon">
              <i className="far fa-angle-double-up" />
            </a>
            <p>
              © <Link href="/">2024</Link> All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Footer3 = () => {
  const { settings } = useEffectiveSettings();
  const agencySettings = settings || {};
  const rawSocial = agencySettings.socialLinks;
  let socialArray = [];
  if (Array.isArray(rawSocial)) {
    socialArray = rawSocial.filter(s => s.url);
  } else if (rawSocial && typeof rawSocial === 'object') {
    const iconMap = { facebook: 'fa-facebook-f', twitter: 'fa-twitter', instagram: 'fa-instagram', linkedin: 'fa-linkedin-in' };
    socialArray = Object.entries(rawSocial).filter(([, url]) => url).map(([k, url]) => ({ id: k, platform: k, icon: iconMap[k] || 'fa-globe', url }));
  }
  return (
    <footer className="footer-section footer-bg">
      <div className="container">
        <div className="footer-widgets-wrapper">
          <div className="row">
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".2s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <Link href="/">
                    <img src="assets/img/logo/white-logo.svg" alt="logo-img" />
                  </Link>
                </div>
                <div className="footer-content">
                  <p>
                    Sed perspiciatis unde omnis natus doloremque laudantium
                    totae
                  </p>
                  <div className="social-icon d-flex align-items-center">
                    {socialArray.map(s => (
                      <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.platform}>
                        <i className={`${s.icon === 'fa-globe' ? 'fas' : 'fab'} ${s.icon}`} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-5 wow fadeInUp"
              data-wow-delay=".4s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Quick Link</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Popular Services</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".6s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Get In Touch</h4>
                </div>
                <div className="contact-info-area">
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-map-marker-alt" />
                    </div>
                    <div className="content">
                      <p>
                        55 Main Street, 2nd block <br />
                        Malborne, Australia
                      </p>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-envelope" />
                    </div>
                    <div className="content">
                      <a href="mailto:info@example.com" className="link">
                        info@example.com
                      </a>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-phone-alt" />
                    </div>
                    <div className="content">
                      <h4>
                        <a href="tel:00012345688">+000 (123) 456 88</a>
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-2 wow fadeInUp"
              data-wow-delay=".8s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Newsletter</h4>
                </div>
                <div className="footer-content">
                  <p>Get more update to join Us</p>
                  <div className="footer-input">
                    <input type="email" id="email" placeholder="Your Email" />
                    <button className="newsletter-btn" type="submit">
                      <i className="far fa-arrow-right" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom style-2">
        <div className="container">
          <div className="footer-wrapper d-flex align-items-center justify-content-between pb-0">
            <ul className="footer-menu">
              <li>
                <Link href="/terms-of-service">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
            </ul>
            <a href="#" id="scrollUp" className="scroll-icon">
              <i className="far fa-angle-double-up" />
            </a>
            <p>
              © <Link href="/">2024</Link> All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Footer4 = () => {
  const { settings, apiBaseUrl, resolveImageUrl, landingPageContent } = useEffectiveSettings();
  const logo = resolveImageUrl(settings?.whiteLogo || settings?.logo) || "assets/img/logo/white-logo.svg";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(""); // "", "loading", "success", "error"

  const agencySettings = settings || {};
  const content = landingPageContent || {};
  
  const footerEmail = agencySettings.adminEmail || "info@hirdanmarketing.com";
  const footerAddress = agencySettings.address || "Cite Barwaqo, Republic of Djibouti";
  const footerPhone = agencySettings.phone || "+253 77 64 61 59";
  const footerTagline = content.footerTagline || "Hirdan Marketing helps businesses build their brand, grow their audience, and turn attention into actual sales.";

  // Normalize socialLinks: support both new array format and legacy {facebook, twitter...} object
  let socialArray = [];
  const rawSocial = agencySettings.socialLinks;
  if (Array.isArray(rawSocial)) {
    socialArray = rawSocial.filter(s => s.url);
  } else {
    let socialObj = {};
    if (typeof rawSocial === "string") {
      try { socialObj = JSON.parse(rawSocial); } catch (e) { socialObj = {}; }
    } else if (rawSocial && typeof rawSocial === "object") {
      socialObj = rawSocial;
    }
    const iconMap = { facebook: 'fa-facebook-f', twitter: 'fa-twitter', instagram: 'fa-instagram', linkedin: 'fa-linkedin-in' };
    socialArray = Object.entries(socialObj)
      .filter(([, url]) => url)
      .map(([key, url]) => ({ id: key, platform: key, icon: iconMap[key] || 'fa-globe', url }));
  }

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const response = await fetch(`${apiBaseUrl}/api/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }).catch((err) => {
        console.warn("Newsletter endpoint not reachable:", err.message);
        return null;
      });
      if (response && response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <footer className="footer-section footer-bg fix">
      <div className="color-shape">
        <img src="/assets/img/footer-color-shape.png" alt="shape-img" />
      </div>
      <div className="color-shape-2">
        <img src="/assets/img/footer-color-shape-2.png" alt="shape-img" />
      </div>
      <div className="container">
        <div className="footer-widgets-wrapper">
          <div className="row">
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".2s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <Link href="/">
                    <img src={logo} alt="logo-img" style={{ maxHeight: "80px", objectFit: "contain" }} />
                  </Link>
                </div>
                <div className="footer-content">
                  <p>{footerTagline}</p>
                  <div className="social-icon d-flex align-items-center">
                    {socialArray.length > 0 ? (
                      socialArray.map(s => (
                        <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.platform}>
                          <i className={`${s.icon === 'fa-globe' ? 'fas' : 'fab'} ${s.icon}`} />
                        </a>
                      ))
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-5 wow fadeInUp"
              data-wow-delay=".4s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Quick Links</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service">Popular Services</Link>
                  </li>
                  <li>
                    <Link href="about">About Company</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".6s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Get In Touch</h4>
                </div>
                <div className="contact-info-area">
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-map-marker-alt" />
                    </div>
                    <div className="content">
                      <p>{footerAddress}</p>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-envelope" />
                    </div>
                    <div className="content">
                      <a href={`mailto:${footerEmail}`} className="link">
                        {footerEmail}
                      </a>
                    </div>
                  </div>
                  <div className="contact-items color-style-2">
                    <div className="icon">
                      <i className="fas fa-phone-alt" />
                    </div>
                    <div className="content">
                      <h4>
                        <a href={`tel:${footerPhone.replace(/\s+/g, '')}`}>{footerPhone}</a>
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-2 wow fadeInUp"
              data-wow-delay=".8s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Newsletter</h4>
                </div>
                <div className="footer-content">
                  <p>Subscribe to our newsletter for marketing updates.</p>
                  <form onSubmit={handleNewsletterSubmit} className="footer-input">
                    <input
                      type="email"
                      placeholder="Your Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === "loading"}
                      required
                    />
                    <button className="newsletter-btn" type="submit" disabled={status === "loading"}>
                      <i className="far fa-arrow-right" />
                    </button>
                  </form>
                  {status === "success" && (
                    <p className="text-success mt-2" style={{ color: "#28a745" }}>Thank you for subscribing!</p>
                  )}
                  {status === "error" && (
                    <p className="text-danger mt-2" style={{ color: "#dc3545" }}>Something went wrong. Try again.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom style-2">
        <div className="container">
          <div className="footer-wrapper d-flex align-items-center justify-content-between pb-0">
            <ul className="footer-menu">
              <li>
                <Link href="/terms-of-service">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
            </ul>
            <a href="#" id="scrollUp" className="scroll-icon">
              <i className="far fa-angle-double-up" />
            </a>
            <p>
              © <Link href="/">{new Date().getFullYear()}</Link> Hirdan Marketing. All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Footer6 = () => {
  return (
    <footer className="footer-section footer-bg">
      <div className="robot-shape float-bob-y">
        <img src="assets/img/home-6/robot-3.png" alt="shape-img" />
      </div>
      <div className="robot-shape-2 float-bob-y">
        <img src="assets/img/home-6/robot-4.png" alt="shape-img" />
      </div>
      <div className="container">
        <div className="discussed-items">
          <div className="footer-logo wow fadeInUp" data-wow-delay=".3s">
            <Link href="/">
              <img src="assets/img/logo/white-logo.svg" alt="logo-img" />
            </Link>
          </div>
          <div className="discussed-content wow fadeInUp" data-wow-delay=".5s">
            <h2>
              Let’s Discussed About <span>Your Projects</span>
            </h2>
            <Link href="contact" className="theme-btn hover-white">
              Get Started <i className="far fa-arrow-right" />
            </Link>
          </div>
        </div>
        <div className="footer-widgets-wrapper">
          <div className="row">
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".2s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>About Us</h4>
                </div>
                <div className="footer-content">
                  <p>
                    Sed perspiciatis unde omnis natus doloremque laudantium
                    totae
                  </p>
                  <div className="social-icon d-flex align-items-center">
                    <a href="#">
                      <i className="fab fa-facebook-f" />
                    </a>
                    <a href="#">
                      <i className="fab fa-twitter" />
                    </a>
                    <a href="#">
                      <i className="fab fa-vimeo-v" />
                    </a>
                    <a href="#">
                      <i className="fab fa-pinterest-p" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-5 wow fadeInUp"
              data-wow-delay=".4s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Quick Link</h4>
                </div>
                <ul className="list-items">
                  <li>
                    <Link href="service-details">Popular Services</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">Privacy Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 ps-lg-1 wow fadeInUp"
              data-wow-delay=".6s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Get In Touch</h4>
                </div>
                <div className="contact-info-area">
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-map-marker-alt" />
                    </div>
                    <div className="content">
                      <p>
                        55 Main Street, 2nd block <br />
                        Malborne, Australia
                      </p>
                    </div>
                  </div>
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-envelope" />
                    </div>
                    <div className="content">
                      <a href="mailto:info@example.com" className="link">
                        info@example.com
                      </a>
                    </div>
                  </div>
                  <div className="contact-items">
                    <div className="icon">
                      <i className="fas fa-phone-alt" />
                    </div>
                    <div className="content">
                      <h4>
                        <a href="tel:00012345688">+000 (123) 456 88</a>
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp"
              data-wow-delay=".8s"
            >
              <div className="single-footer-widget">
                <div className="widget-head">
                  <h4>Recent News</h4>
                </div>
                <div className="recent-post-area">
                  <div className="recent-post-items">
                    <div
                      className="thumb bg-cover"
                      style={{
                        backgroundImage: 'url("assets/img/news/pp1.png")',
                      }}
                    />
                    <div className="content">
                      <ul className="post-date">
                        <li>Nov 25, 2024</li>
                      </ul>
                      <h6>
                        <Link href="news-details">
                          How achieve more <br /> your nine to five
                        </Link>
                      </h6>
                    </div>
                  </div>
                  <div className="recent-post-items mb-0">
                    <div
                      className="thumb bg-cover"
                      style={{
                        backgroundImage: 'url("assets/img/news/pp2.png")',
                      }}
                    />
                    <div className="content">
                      <ul className="post-date">
                        <li>Nov 29, 2024</li>
                      </ul>
                      <h6>
                        <Link href="news-details">
                          Discover a better way of company.
                        </Link>
                      </h6>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container">
            <div className="footer-wrapper d-flex align-items-center justify-content-between">
              <ul className="footer-menu wow fadeInUp" data-wow-delay=".2s">
                <li>
                  <Link href="/terms-of-service">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/privacy-policy">Privacy Policy</Link>
                </li>
              </ul>
              <a
                href="#"
                id="scrollUp"
                className="scroll-icon wow fadeInUp"
                data-wow-delay=".4s"
              >
                <i className="far fa-angle-double-up" />
              </a>
              <p className="wow fadeInUp" data-wow-delay=".6s">
                © <Link href="/">2024</Link> All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
