"use client";

import FunFactCounter from "@/components/FunFactCounter";
import Team from "@/components/Team";
import { TestimonialSlider2 } from "@/components/TestimonialSlider";
import { WorkingProcess2 } from "@/components/WorkingProcess";
import NextLayout from "@/layouts/NextLayout";
import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";

const Page = () => {
  const { landingPageContent, resolveImageUrl } = useSettings();
  const content = landingPageContent || {};

  const missionBullets = (content.aboutMissionBullets ? content.aboutMissionBullets.split("\n") : [
    "Build Your Brand's Online Presence — with consistency and creativity across every channel.",
    "Create Content That Connects — messaging that speaks directly to your audience.",
    "Deliver Measurable Growth — results that help you sell more and scale faster."
  ]);

  return (
    <NextLayout>

      {/* About Section Start */}
      <section className="about-section fix section-padding pb-0">
        <div className="container">
          <div className="about-wrapper style-2">
            <div className="row g-4 align-items-center">
              <div className="col-lg-6">
                <div className="about-content ms-0 style-about">
                  <div className="section-title">
                    <span className="sub-content wow fadeInUp">
                      <img src="assets/img/bale.png" alt="img" />
                      {content.aboutSubtitle || "Who We Are"}
                    </span>
                    <h2 className="wow fadeInUp" data-wow-delay=".3s">
                      {content.aboutTitle || "A Full-Service Digital Marketing Agency"}
                    </h2>
                  </div>
                  <p className="mt-3 mt-md-0 wow fadeInUp" data-wow-delay=".5s">
                    {content.aboutDescription || "Hirdan Marketing is a full-service digital marketing agency helping businesses grow their visibility, attract new customers, and increase sales. We bring together strategy, design, and content under one team, so every part of your presence works toward the same goal."}
                  </p>
                  <div className="icon-items wow fadeInUp" data-wow-delay=".3s">
                    <div className="dot" />
                    <div className="content">
                      <h4>Quality You Can Count On</h4>
                      <p>
                        Every project gets the same level of care, from a single flyer to a full campaign.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6 wow fadeInUp" data-wow-delay=".4s">
                <div className="about-image-3">
                  <img src={resolveImageUrl(content.aboutImageUrl) || "assets/img/about/05.jpg"} alt="img" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* About Section Start */}
      <section className="about-section fix section-padding pt-80">
        <div className="container">
          <div className="about-wrapper style-2">
            <div className="row g-4 align-items-center">
              <div className="col-lg-6 wow  fadeInUp" data-wow-delay=".3s">
                <div className="about-image-3">
                  <img src="assets/img/about/06.jpg" alt="img" />
                </div>
              </div>
              <div className="col-lg-6">
                <div className="about-content">
                  <h4 className="wow fadeInUp" data-wow-delay=".3s">
                    {content.aboutMissionTitle || "Our Mission Is Simple"}
                  </h4>
                  <p className="mt-3 wow fadeInUp" data-wow-delay=".5s">
                    {content.aboutMissionDesc || "We combine strategy, design, and content to help our clients stand out and grow — with results you can actually measure."}
                  </p>
                  
                  {missionBullets.map((bullet, idx) => {
                    const parts = bullet.split(" — ");
                    const title = parts[0] || "";
                    const desc = parts[1] || "";
                    return (
                      <div key={idx} className="icon-items wow fadeInUp" data-wow-delay=".3s">
                        <div className="dot" />
                        <div className="content">
                          <h4>{title}</h4>
                          {desc && <p>{desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                  
                  <Link
                    href="contact"
                    className="theme-btn mt-50 wow fadeInUp"
                    data-wow-delay=".5s"
                  >
                    Get A Quote
                    <i className="far fa-arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Team Section Start */}
      <Team />
      {/* Funfact Section Start */}
      <section className="funfact-section-2 section-padding pt-0">
        <div className="container">
          <FunFactCounter style={2} />
        </div>
      </section>
      {/* Working Process Section Start */}
      <WorkingProcess2 />
      {/* Brand Section Start */}
      <section className="brand-section-2 mt-0 mb-0 fix section-padding pt-0">
        <div className="container-fluid">
          <div className="brand-wrapper-2">
            <div className="radius-shape">
              <img src="assets/img/brand/radius-left.png" alt="shape-img" />
            </div>
            <div className="radius-shape-2">
              <img src="assets/img/brand/radius-right.png" alt="shape-img" />
            </div>
            <h5 className="wow fadeInUp" data-wow-delay=".3s">
              Some Of The Brands We've Worked With
            </h5>
            <div className="brand-items">
              <div className="brand-image wow fadeInUp" data-wow-delay=".2s">
                <img src="assets/img/brand/linkedIn.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".4s">
                <img src="assets/img/brand/dropbox.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".6s">
                <img src="assets/img/brand/trello.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".8s">
                <img src="assets/img/brand/framer.png" alt="img" />
              </div>
            </div>
            <div className="brand-items">
              <div className="brand-image wow fadeInUp" data-wow-delay=".2s">
                <img src="assets/img/brand/grammarly.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".4s">
                <img src="assets/img/brand/amazon.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".6s">
                <img src="assets/img/brand/outbrain.png" alt="img" />
              </div>
              <div className="brand-image wow fadeInUp" data-wow-delay=".8s">
                <img src="assets/img/brand/shopify.png" alt="img" />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Testimonial Section Start */}
      <section className="testimonial-section-2 fix section-padding fix">
        <div className="bg-shape">
          <img src="assets/img/testimonial/bg-shape.png" alt="shape-img" />
        </div>
        <div className="container">
          <div className="section-title text-center">
            <span className="sub-content">
              <img src="assets/img/bale.png" alt="img" />
              Clients Feedback
            </span>
            <h2>What Our Clients Say</h2>
          </div>
        </div>
        <TestimonialSlider2 />
      </section>
    </NextLayout>
  );
};
export default Page;
