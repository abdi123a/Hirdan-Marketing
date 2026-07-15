"use client";
import Link from "next/link";
import { useSettings } from "./SettingsProvider";

const Services = () => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  const defaultServices = [
    { "title": "Graphic Design", "description": "Logos, branding, flyers, and posters that give your business a polished, professional identity.", "icon": "flaticon-graphic-design" },
    { "title": "Social Media Marketing", "description": "Strategy, scheduled posting, and advertising that keeps your brand active and growing.", "icon": "flaticon-social-media" },
    { "title": "Content Creation & Copywriting", "description": "Visuals and messaging built to capture attention and drive action.", "icon": "flaticon-copy-writing" },
    { "title": "Website Development", "description": "Modern, responsive websites designed to turn visitors into customers.", "icon": "flaticon-software-development" },
    { "title": "Photography", "description": "Professional, high-quality imagery for your products, team, and events.", "icon": "flaticon-camera" },
    { "title": "Videography", "description": "Promotional videos and storytelling content built to be shared.", "icon": "flaticon-video" }
  ];

  const servicesList = content.servicesJson && content.servicesJson.length > 0 ? content.servicesJson : defaultServices;

  return (
    <section
      className="service-section-4 fix bg-cover section-padding"
      style={{
        backgroundImage: 'url("assets/img/service/service-bg-min.jpg")',
      }}
      id="services"
    >
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content bg-color-3 wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            Popular Services
          </span>
          <h2 className="text-white wow fadeInUp" data-wow-delay=".3s">
            We Provide Best Digital Marketing <br />
            services to build a modern &amp; <br /> professional presence for
            clients
          </h2>
        </div>
        <div className="row">
          {servicesList.map((service, idx) => (
            <div
              key={idx}
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay={`${0.2 * (idx % 3 + 1)}s`}
            >
              <div className={`service-box-items ${idx === 1 ? "active" : ""}`}>
                <div className="icon">
                  <i className={service.icon || "flaticon-graphic-design"} />
                </div>
                <div className="content">
                  <h3>
                    <Link href="contact">{service.title}</Link>
                  </h3>
                  <p>{service.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default Services;

export const Service2 = ({ paddingTop = 0, title = "Popular Services" }) => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  const defaultServices = [
    { "title": "Graphic Design", "description": "Logos, branding, flyers, and posters that give your business a polished, professional identity.", "icon": "flaticon-graphic-design" },
    { "title": "Social Media Marketing", "description": "Strategy, scheduled posting, and advertising that keeps your brand active and growing.", "icon": "flaticon-social-media" },
    { "title": "Content Creation & Copywriting", "description": "Visuals and messaging built to capture attention and drive action.", "icon": "flaticon-copy-writing" }
  ];

  const servicesList = content.servicesJson && content.servicesJson.length > 0 ? content.servicesJson.slice(0, 3) : defaultServices;

  const images = [
    "assets/img/service/01.jpg",
    "assets/img/service/02.jpg",
    "assets/img/service/03.jpg"
  ];

  return (
    <section
      className={`service-section section-padding pt-${paddingTop}`}
      id="services"
    >
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            {title}
          </span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            We Provide Best Modern Marketing <br />
            Services For Your Business
          </h2>
        </div>
        <div className="row">
          {servicesList.map((service, idx) => (
            <div
              key={idx}
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay={`${0.2 * (idx + 1)}s`}
            >
              <div className="service-popular-items">
                <div className="service-image">
                  <img src={images[idx % images.length]} alt="img" />
                </div>
                <div className="service-content">
                  <h3>
                    <Link href="contact">{service.title}</Link>
                  </h3>
                  <p>{service.description}</p>
                  <Link href="contact" className="theme-btn bg-2">
                    Learn More <i className="far fa-arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
