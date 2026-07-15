"use client";
import Faq from "@/components/Faq";
import Services from "@/components/Services";
import { useSettings } from "@/components/SettingsProvider";
import {
  TestimonialSlider4,
  TestimonialSlider5,
} from "@/components/TestimonialSlider";
import WorkingProcess from "@/components/WorkingProcess";
import NextLayout from "@/layouts/NextLayout";
import Link from "next/link";
import ClientSlider from "@/components/ClientSlider";
const page = () => {
  const { landingPageContent, resolveImageUrl } = useSettings();
  const content = landingPageContent || {};
  return (
    <NextLayout header={2} footer={4}>
      {/* Hero Section Start */}
      <section className="hero-section hero-4">
        <div className="container">
          <div className="row g-4 align-items-center justify-content-between align-items-center">
            <div className="col-lg-6">
              <div className="hero-content">
                <span className="sub-content wow fadeInUp" data-wow-delay=".2s">
                  <img src={resolveImageUrl(content.heroBadgeImageUrl) || "assets/img/bale.png"} alt="img" />
                  {content.heroSubtitle || "Digital Marketing Agency"}
                </span>
                <h1 className="wow fadeInUp" data-wow-delay=".4s">
                  {content.heroTitle || "Marketing That Builds Real Growth"}
                </h1>
                <p className="wow fadeInUp" data-wow-delay=".5s">
                  {content.heroDescription || "Hirdan Marketing helps businesses build their brand, grow their audience, and turn attention into actual sales — through strategy, design, and content that works."}
                </p>
                <div className="about-author">
                  <div
                    className="about-button wow fadeInUp"
                    data-wow-delay=".3s"
                  >
                    <Link href="contact" className="theme-btn">
                      {content.heroBtn1Text || "Get A Quote"}
                      <i className="fas fa-long-arrow-right" />
                    </Link>
                  </div>
                  <div
                    className="author-image wow fadeInUp"
                    data-wow-delay=".5s"
                  >
                    <img
                      src={resolveImageUrl(content.trustImageUrl) || "assets/img/about/face-mans-2.png"}
                      alt="author-img"
                    />
                    <div className="content">
                      <h6>
                        {content.heroAwardLabel || "Trusted by 15+ businesses and organizations"}
                        {content.heroAwardNumber && (
                          <>
                            <br />
                            {content.heroAwardNumber}
                          </>
                        )}
                      </h6>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-5 wow fadeInUp" data-wow-delay=".4s">
              <div className="hero-image">
                <img
                  src={resolveImageUrl(content.heroImageUrl) || "assets/img/hero/digital-marketing-hero-img-min.png"}
                  alt="img"
                />
                <div className="circle-musk-shape float-bob-x">
                  <img src={resolveImageUrl(content.heroShapeImageUrl) || "assets/img/hero/circle-musk.png"} alt="shape-img" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Brand Section Start */}
      <section className="brand-section-2 fix">
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
            <div className="mt-5">
              <ClientSlider />
            </div>
          </div>
        </div>
      </section>
      {/* About Section Start */}
      <section className="about-section fix section-padding">
        <div className="container">
          <div className="about-wrapper">
            <div className="row g-4 align-items-center justify-content-between">
              <div className="col-lg-6 wow fadeInUp" data-wow-delay=".3s">
                <div className="digital-about-image">
                  <img
                    src={resolveImageUrl(content.aboutImageUrl) || "assets/img/about/digittal-about-img.png"}
                    alt="img"
                  />
                </div>
              </div>
              <div className="col-lg-6">
                <div className="about-content">
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
                  <ul
                    className="about-list style-2 wow fadeInUp"
                    data-wow-delay=".3s"
                  >
                    {(content.aboutBullets ? content.aboutBullets.split(",") : ["Consistent, high-quality content", "Clear reporting on real performance"]).map((bullet, idx) => (
                      <li key={idx}>
                        <i className="fas fa-check-circle" />
                        {bullet.trim()}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="about-button wow fadeInUp"
                    data-wow-delay=".5s"
                  >
                    <Link href="service" className="theme-btn bg-2">
                      See What We Do
                      <i className="far fa-arrow-right" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Service Section Start */}
      <Services />
      {/* Working Process Section Start */}
      <WorkingProcess />
      {/* Testimonial Section Start */}
      <section className="testimonial-section-4 fix section-padding">
        <div className="container">
          <div className="section-title text-center">
            <span className="sub-content wow fadeInUp">
              <img src="assets/img/bale.png" alt="img" />
              Testimonials
            </span>
            <h2 className="text-white wow fadeInUp" data-wow-delay=".3s">
              We’ve 1250+ Global Clients Say Us
            </h2>
          </div>
        </div>

        <TestimonialSlider4 />
        <TestimonialSlider5 />
      </section>
      {/* Faq Section Start */}
      <Faq />
      {/* News Section Start */}
      <section className="news-section section-padding pt-0">
        <div className="container">
          <div className="section-title text-center">
            <span className="sub-content wow fadeInUp">
              <img src="assets/img/bale.png" alt="img" />
              News &amp; Blog
            </span>
            <h2 className="wow fadeInUp" data-wow-delay=".3s">
              Explore Our Latest News &amp; Blog
            </h2>
          </div>
          <div className="row">
            <div
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay=".3s"
            >
              <div className="news-card-items style-2">
                <div
                  className="news-image bg-cover"
                  style={{ backgroundImage: 'url("assets/img/news/07.jpg")' }}
                />
                <div className="news-content">
                  <p>November 25, 2024</p>
                  <h4>
                    <Link href="news-details">
                      Achieving Fashion Elegan Runway to Real Life
                    </Link>
                  </h4>
                  <Link className="link-btn" href="news-details">
                    Read More
                    <i className="far fa-arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
            <div
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay=".5s"
            >
              <div className="news-card-items style-2">
                <div
                  className="news-image bg-cover"
                  style={{ backgroundImage: 'url("assets/img/news/08.jpg")' }}
                />
                <div className="news-content">
                  <p>November 25, 2024</p>
                  <h4>
                    <Link href="news-details">
                      Remote work made easy way better tools.
                    </Link>
                  </h4>
                  <Link className="link-btn" href="news-details">
                    Read More
                    <i className="far fa-arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
            <div
              className="col-xl-4 col-lg-6 col-md-6 wow fadeInUp"
              data-wow-delay=".7s"
            >
              <div className="news-card-items style-2">
                <div
                  className="news-image bg-cover"
                  style={{ backgroundImage: 'url("assets/img/news/09.jpg")' }}
                />
                <div className="news-content">
                  <p>November 25, 2024</p>
                  <h4>
                    <Link href="news-details">
                      Achieving Fashion Elegan Runway to Real Life
                    </Link>
                  </h4>
                  <Link className="link-btn" href="news-details">
                    Read More
                    <i className="far fa-arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Contact Section Start */}
      <section className="contact-section fix section-padding pt-0 fix">
        <div className="pattern-shape">
          <img src="assets/img/box-pattern.png" alt="radius-shape" />
        </div>
        <div className="container">
          <div className="row g-4 justify-content-center align-items-center">
            <div className="col-lg-1" />
            <div className="col-lg-4 wow fadeInUp" data-wow-delay=".3s">
              <div className="contact-image">
                <img src={resolveImageUrl(content.contactImageUrl) || "assets/img/contact.jpg"} alt="img" />
                <div className="circle-musk-shape float-bob-x">
                  <img src="assets/img/hero/circle-musk.png" alt="shape-img" />
                </div>
              </div>
            </div>
            <div className="col-lg-1" />
            <div className="col-lg-6">
              <div className="section-title">
                <span className="sub-content wow fadeInUp">
                  <img src="assets/img/bale.png" alt="img" />
                  {content.ctaSubtitle || "Let's Work Together"}
                </span>
                <h2 className="wow fadeInUp" data-wow-delay=".3s">
                  {content.ctaTitle || "Ready To Grow Your Brand? Let's Start Today."}
                </h2>
              </div>
              <p className="mt-3 mt-md-0 wow fadeInUp" data-wow-delay=".5s">
                {content.ctaDescription || "We build your brand, manage your presence, and help you grow — with clear communication at every step."}
              </p>
              <Link
                href="contact"
                className="theme-btn mt-4 wow fadeInUp"
                data-wow-delay=".3s"
              >
                Get A Quote
                <i className="far fa-arrow-right" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </NextLayout>
  );
};
export default page;
