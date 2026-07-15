"use client";
import { nextUtility } from "@/utility";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
const Header = ({ header, single }) => {
  useEffect(() => {
    nextUtility.stickyNav();
  }, []);

  switch (header) {
    case 1:
      return <Header1 single={single} />;
    case 2:
      return <Header2 single={single} />;
    case 3:
      return <Header3 single={single} />;
    case 5:
      return <Header5 single={single} />;
    case 6:
      return <Header6 single={single} />;
    default:
      return <Header6 single={single} />;
  }
};
export default Header;

const Menu = ({ single }) => {
  return (
    <Fragment>
      <nav id="mobile-menu" className="d-none d-xl-block">
        <ul>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href={single ? "#about" : "/about"}>About</Link>
          </li>
          <li>
            <Link href={single ? "#services" : "/service"}>Services</Link>
          </li>
          <li>
            <Link href={single ? "#projects" : "/project"}>Projects</Link>
          </li>
          <li>
            <Link href={single ? "#blog" : "/news"}>Blog</Link>
          </li>
          <li>
            <Link href={single ? "#contact" : "/contact"}>Contacts</Link>
          </li>
        </ul>
      </nav>
    </Fragment>
  );
};

const MobileMenu = ({ single }) => {
  return (
    <div className="mobile-menu fix mb-3 mean-container d-block d-xl-none">
      <div className="mean-bar">
        <a href="#nav" className="meanmenu-reveal">
          <span>
            <span>
              <span />
            </span>
          </span>
        </a>
        <nav className="mean-nav">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href={single ? "#about" : "/about"}>About</Link>
            </li>
            <li>
              <Link href={single ? "#services" : "/service"}>Services</Link>
            </li>
            <li>
              <Link href={single ? "#projects" : "/project"}>Projects</Link>
            </li>
            <li>
              <Link href={single ? "#blog" : "/news"}>Blog</Link>
            </li>
            <li className="mean-last">
              <Link href={single ? "#contact" : "/contact"}>Contacts</Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

const Sidebar = ({ sidebarToggle, close, menu, single }) => {
  const { settings, appUrl, resolveImageUrl } = useSettings();
  const logo = resolveImageUrl(settings?.logo) || "assets/img/logo/black-logo.svg";

  const agencySettings = settings || {};
  const email = agencySettings.adminEmail || "info@hirdanmarketing.com";
  const address = agencySettings.address || "Cite Barwaqo, Republic of Djibouti";
  const phone = agencySettings.phone || "+253 77 64 61 59";

  let social = {};
  if (typeof agencySettings.socialLinks === "string") {
    try {
      social = JSON.parse(agencySettings.socialLinks);
    } catch (e) {
      social = {};
    }
  } else if (agencySettings.socialLinks && typeof agencySettings.socialLinks === "object") {
    social = agencySettings.socialLinks;
  }

  return (
    <Fragment>
      <div className="fix-area">
        <div className={`offcanvas__info ${sidebarToggle ? "info-open" : ""}`}>
          <div className="offcanvas__wrapper">
            <div className="offcanvas__content">
              <div className="offcanvas__top mb-5 d-flex justify-content-between align-items-center">
                <div className="offcanvas__logo">
                  <Link href="/">
                    <img src={logo} alt="logo-img" style={{ maxHeight: "80px", objectFit: "contain" }} />
                  </Link>
                </div>
                <div className="offcanvas__close" onClick={() => close()}>
                  <button>
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>
              <div className="mobile-menu fix mb-3">
                <MobileMenu single={single} menu={menu} />
              </div>
              <p className="text d-none d-xl-block mb-5">
                Hirdan Marketing is a full-service digital marketing agency helping businesses grow their visibility, attract new customers, and increase sales.
              </p>
              <div className="offcanvas__contact">
                <h4>Contact Info</h4>
                <ul>
                  <li className="d-flex align-items-center">
                    <div className="offcanvas__contact-icon">
                      <i className="fal fa-map-marker-alt" />
                    </div>
                    <div className="offcanvas__contact-text">
                      <a target="_blank" href="#contact" onClick={() => close()}>
                        {address}
                      </a>
                    </div>
                  </li>
                  <li className="d-flex align-items-center">
                    <div className="offcanvas__contact-icon mr-15">
                      <i className="fal fa-envelope" />
                    </div>
                    <div className="offcanvas__contact-text">
                      <a href={`mailto:${email}`}>{email}</a>
                    </div>
                  </li>
                  <li className="d-flex align-items-center">
                    <div className="offcanvas__contact-icon mr-15">
                      <i className="fal fa-clock" />
                    </div>
                    <div className="offcanvas__contact-text">
                      <span className="text-muted">Saturday - Thursday, 09am - 05pm</span>
                    </div>
                  </li>
                  <li className="d-flex align-items-center">
                    <div className="offcanvas__contact-icon mr-15">
                      <i className="far fa-phone" />
                    </div>
                    <div className="offcanvas__contact-text">
                      <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                    </div>
                  </li>
                </ul>
                <div className="header-button mt-4 d-flex flex-column gap-2">
                  <Link href="contact" className="theme-btn text-center" onClick={() => close()}>
                    Contact Us
                  </Link>
                </div>
                <div className="social-icon d-flex align-items-center">
                  {social.facebook && (
                    <a href={social.facebook} target="_blank" rel="noreferrer">
                      <i className="fab fa-facebook-f" />
                    </a>
                  )}
                  {social.twitter && (
                    <a href={social.twitter} target="_blank" rel="noreferrer">
                      <i className="fab fa-twitter" />
                    </a>
                  )}
                  {social.linkedin && (
                    <a href={social.linkedin} target="_blank" rel="noreferrer">
                      <i className="fab fa-linkedin-in" />
                    </a>
                  )}
                  {social.instagram && (
                    <a href={social.instagram} target="_blank" rel="noreferrer">
                      <i className="fab fa-instagram" />
                    </a>
                  )}
                  {!social.facebook && !social.twitter && !social.linkedin && !social.instagram && (
                    <>
                      <a href="https://facebook.com/hirdan" target="_blank" rel="noreferrer"><i className="fab fa-facebook-f" /></a>
                      <a href="https://twitter.com/hirdan" target="_blank" rel="noreferrer"><i className="fab fa-twitter" /></a>
                      <a href="https://linkedin.com/company/hirdan" target="_blank" rel="noreferrer"><i className="fab fa-linkedin-in" /></a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`offcanvas__overlay ${sidebarToggle ? "overlay-open" : ""}`}
        onClick={() => close()}
      />
    </Fragment>
  );
};

const Header1 = ({ single, menu }) => {
  const [sidebarToggle, setSidebarToggle] = useState(false);
  return (
    <Fragment>
      <header id="header-sticky" className="header-1">
        <div className="container-fluid">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="sticky-logo">
                <Link href="/">
                  <img
                    src="assets/img/logo/white-logo.svg"
                    alt="logo-img"
                    className="logo-1"
                  />
                </Link>
                <Link href="/">
                  <img
                    src="assets/img/logo/black-logo.svg"
                    alt="logo-img"
                    className="logo-2"
                  />
                </Link>
              </div>
              <div className="header-left">
                <div className="mean__menu-wrapper">
                  <div className="main-menu">
                    <Menu single={single} />
                  </div>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center">
                <div className="icon-items">
                  <div className="icon">
                    <i className="fas fa-phone-alt" />
                  </div>
                  <div className="content">
                    <p>Make A Call</p>
                    <h4>
                      <a href="tel:+00012345688">+000 (123) 456 88</a>
                    </h4>
                  </div>
                </div>
                <div className="header__hamburger d-xl-block my-auto">
                  <div
                    className="sidebar__toggle"
                    onClick={() => setSidebarToggle(true)}
                  >
                    <i className="far fa-bars" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <Sidebar
        sidebarToggle={sidebarToggle}
        close={() => setSidebarToggle(false)}
        single={single}
      />
    </Fragment>
  );
};

const Header2 = ({ single }) => {
  const { settings, appUrl, resolveImageUrl } = useSettings();
  const logo = resolveImageUrl(settings?.logo) || "assets/img/logo/black-logo.svg";

  const singleMenu = [
    { id: 1, href: "about", title: "About" },
    { id: 2, href: "services", title: "Services" },
    { id: 3, href: "projects", title: "Projects" },
    { id: 4, href: "testimonial", title: "Testimonial" },
  ];

  const [sidebarToggle, setSidebarToggle] = useState(false);
  return (
    <Fragment>
      <header id="header-sticky" className="header-2">
        <div className="container">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="sticky-logo">
                <Link href="/">
                  <img src={logo} alt="logo-img" style={{ maxHeight: "80px", objectFit: "contain" }} />
                </Link>
              </div>
              <div className="header-left">
                <div className="mean__menu-wrapper">
                  <div className="main-menu">
                    <Menu single={single} menu={singleMenu} />
                  </div>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center gap-3">
                <div className="header-button d-none d-xl-flex align-items-center gap-2">
                  <Link href="contact" className="theme-btn">
                    Get A Quote
                  </Link>
                </div>
                <div className="header__hamburger d-xl-none my-auto">
                  <div
                    className="sidebar__toggle"
                    onClick={() => setSidebarToggle(true)}
                  >
                    <i className="far fa-bars" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <Sidebar
        sidebarToggle={sidebarToggle}
        close={() => setSidebarToggle(false)}
        single={single}
        menu={singleMenu}
      />
    </Fragment>
  );
};

const Header3 = ({ single }) => {
  const [sidebarToggle, setSidebarToggle] = useState(false);
  const singleMenu = [
    { id: 2, href: "services", title: "Services" },
    { id: 1, href: "about", title: "About" },
    { id: 3, href: "team", title: "Team" },
    { id: 4, href: "testimonial", title: "Testimonial" },
    { id: 4, href: "blog", title: "Blog" },
  ];
  return (
    <Fragment>
      <header id="header-sticky" className="header-2">
        <div className="container-fluid">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="sticky-logo">
                <Link href="/">
                  <img src="assets/img/logo/black-logo.svg" alt="logo-img" />
                </Link>
              </div>
              <div className="header-left">
                <div className="mean__menu-wrapper">
                  <div className="main-menu">
                    <Menu single={single} menu={singleMenu} />
                  </div>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center">
                <div className="icon-items">
                  <div className="icon">
                    <i className="fas fa-phone-alt" />
                  </div>
                  <div className="content">
                    <p>Make A Call</p>
                    <h4>
                      <a href="tel:+00012345688">+000 (123) 456 88</a>
                    </h4>
                  </div>
                </div>
                <div className="header-button">
                  <Link href="contact" className="theme-btn bg-2">
                    Get A Quote
                  </Link>
                </div>
                <div className="header__hamburger d-xl-none my-auto">
                  <div
                    className="sidebar__toggle"
                    onClick={() => setSidebarToggle(true)}
                  >
                    <i className="far fa-bars" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <Sidebar
        sidebarToggle={sidebarToggle}
        close={() => setSidebarToggle(false)}
        single={single}
        menu={singleMenu}
      />
    </Fragment>
  );
};

const Header5 = ({ single }) => {
  const [sidebarToggle, setSidebarToggle] = useState(false);
  const singleMenu = [
    { id: 1, href: "about", title: "About" },
    { id: 2, href: "services", title: "Services" },
    { id: 3, href: "projects", title: "Projects" },
    { id: 4, href: "contact", title: "Contact" },
  ];
  return (
    <Fragment>
      <header id="header-sticky" className="header-6">
        <div className="container">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="sticky-logo">
                <Link href="/" className="logo-1">
                  <img src="assets/img/logo/white-logo.svg" alt="logo-img" />
                </Link>
                <Link href="/" className="logo-2">
                  <img src="assets/img/logo/black-logo.svg" alt="logo-img" />
                </Link>
              </div>
              <div className="header-left">
                <div className="mean__menu-wrapper">
                  <div className="main-menu">
                    <Menu single={single} menu={singleMenu} />
                  </div>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center">
                <div className="header__hamburger d-xl-block my-auto">
                  <div
                    className="sidebar__toggle"
                    onClick={() => setSidebarToggle(true)}
                  >
                    <i className="far fa-bars" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <Sidebar
        sidebarToggle={sidebarToggle}
        close={() => setSidebarToggle(false)}
        single={single}
        menu={singleMenu}
      />
    </Fragment>
  );
};

const Header6 = ({ single }) => {
  const { settings, appUrl, resolveImageUrl } = useSettings();
  const logo = resolveImageUrl(settings?.logo) || "assets/img/logo/black-logo.svg";

  const [sidebarToggle, setSidebarToggle] = useState(false);
  return (
    <Fragment>
      <header id="header-sticky" className="header-3">
        <div className="container">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="sticky-logo">
                <Link href="/">
                  <img src={logo} alt="logo-img" style={{ maxHeight: "80px", objectFit: "contain" }} />
                </Link>
              </div>
              <div className="header-left">
                <div className="mean__menu-wrapper">
                  <div className="main-menu">
                    <Menu single={single} />
                  </div>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center gap-3">
                <div className="header-button d-none d-xl-flex align-items-center gap-2">
                  <Link href="contact" className="theme-btn">
                    Get A Quote
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <Sidebar
        sidebarToggle={sidebarToggle}
        close={() => setSidebarToggle(false)}
        single={single}
      />
    </Fragment>
  );
};
