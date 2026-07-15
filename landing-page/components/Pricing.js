"use client";
import Link from "next/link";
import { useSettings } from "./SettingsProvider";

const defaultPackages = [
  {
    "name": "Starter",
    "price": "120,000 FDJ/month",
    "bestFor": "businesses wanting credibility and consistent visibility.",
    "features": [
      "3 Platforms",
      "10 Posts/month",
      "2 Stories/week",
      "Basic Community Management",
      "Hashtag & Post Optimization",
      "Monthly Report"
    ]
  },
  {
    "name": "Growth",
    "price": "160,000 FDJ/month",
    "bestFor": "brands that want to grow aggressively.",
    "features": [
      "4 Platforms",
      "12 Posts/month",
      "3 Stories/week",
      "Active Community Management",
      "3 Targeted Ad Campaigns/month",
      "Branded Visual Identity",
      "$50 Ads Credit",
      "Detailed Monthly Report"
    ]
  },
  {
    "name": "Premium",
    "price": "199,000 FDJ/month",
    "bestFor": "businesses that want to lead their industry online.",
    "features": [
      "5 Platforms",
      "16–20 Premium Posts/month",
      "5 Stories/week",
      "Full Community Management",
      "Creative Campaigns & Storytelling",
      "Up to 9 Ad Campaigns/month",
      "$100 Ads Credit",
      "Monthly Report + Strategy Meetings"
    ]
  }
];

const Pricing = () => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};
  const packagesList = content.packagesJson && content.packagesJson.length > 0 ? content.packagesJson : defaultPackages;

  return (
    <section className="pricing-section section-padding">
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            Pricing Package
          </span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            Flexible Packages Built For Your Growth
          </h2>
        </div>
        <div className="row">
          {packagesList.map((pkg, idx) => (
            <div
              key={idx}
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay={`${0.2 * (idx + 1)}s`}
            >
              <div className={`pricing-card-items ${idx === 1 ? "active" : ""}`}>
                <div className="pricing-shape">
                  <img src={idx === 1 ? "assets/img/pricing-shape-2.png" : "assets/img/pricing-shape.png"} alt="shape-img" />
                </div>
                <div className="pricing-header">
                  <h3>{pkg.name} Plan</h3>
                  <p>{pkg.bestFor || "Hirdan Marketing Plan"}</p>
                </div>
                <ul className="pricing-list">
                  {pkg.features && pkg.features.map((feature, fIdx) => (
                    <li key={fIdx} className={fIdx >= 5 ? "style-2" : ""}>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="pricing-bottom">
                  <h2>
                    {pkg.price}
                  </h2>
                  <p>{pkg.bestFor || "Hirdan Marketing Plan"}</p>
                </div>
                <div className="pricing-button">
                  <Link href="contact" className="theme-btn style-transparent">
                    Choose Package
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
export default Pricing;

export const Pricing2 = ({
  priceingClass = "pricing-section-3",
  paddingTop = "0",
}) => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};
  const packagesList = content.packagesJson && content.packagesJson.length > 0 ? content.packagesJson : defaultPackages;

  return (
    <section
      className={`fix section-padding pt-${paddingTop} ${priceingClass}`}
      id="pricing"
    >
      <div className="container">
        <div className="section-title text-center">
          <span className="sec-sub-text-2 wow fadeInUp">Pricing Package</span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            We Offer Amazing Pricing Packages <br />
            Built To Fit Your Budget
          </h2>
        </div>
        <div className="row">
          {packagesList.map((pkg, idx) => (
            <div
              key={idx}
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay={`${0.2 * (idx + 1)}s`}
            >
              <div className={`pricing-card-items-2 ${idx === 1 ? "active" : ""}`}>
                <div className="pricing-header">
                  <h3>{pkg.name} Plan</h3>
                  <p>{pkg.bestFor || "Hirdan Marketing Plan"}</p>
                </div>
                <div className="pricing-button">
                  <Link href="contact" className="theme-btn bg-header">
                    Choose Package
                  </Link>
                </div>
                <div className="price-items">
                  <h2>
                    {pkg.price.includes(" ") ? (
                      <>
                        {pkg.price.split(" ")[0]} <span>{pkg.price.substring(pkg.price.indexOf(" "))}</span>
                      </>
                    ) : (
                      <>
                        {pkg.price}
                      </>
                    )}
                  </h2>
                </div>
                <ul className="price-list">
                  {pkg.features && pkg.features.map((feature, fIdx) => (
                    <li key={fIdx}>
                      <i className="far fa-check" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
