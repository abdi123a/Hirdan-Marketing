"use client";

import NextLayout from "@/layouts/NextLayout";
import { useSettings } from "@/components/SettingsProvider";

const Page = () => {
  const { settings } = useSettings();
  const agencySettings = settings || {};

  const email = agencySettings.adminEmail || "info@hirdanmarketing.com";
  const address = agencySettings.address || "Cite Barwaqo, Republic of Djibouti";
  const phone = agencySettings.phone || "+253 77 64 61 59";

  return (
    <NextLayout>

      {/* Contact Section Section Start */}
      <section className="contact-section section-padding">
        <div className="container">
          <div className="contact-wrapper">
            <div className="row g-4">
              <div className="col-lg-6">
                <div className="contact-content">
                  <div className="section-title">
                    <span className="sub-content wow fadeInUp">
                      <img src="assets/img/bale.png" alt="img" />
                      Contact Us
                    </span>
                    <h2 className="wow fadeInUp" data-wow-delay=".3s">
                      Don’t Hesitate to Contact <br />
                      Our Team Member
                    </h2>
                  </div>
                  <p className="mt-3 mt-md-0 wow fadeInUp" data-wow-delay=".5s">
                    Hirdan Marketing is here to help your business grow. Reach out to us today to discuss your digital strategy, design, or content needs.
                  </p>
                  <ul
                    className="contact-list wow fadeInUp"
                    data-wow-delay=".3s"
                  >
                    <li>
                      <a href={`mailto:${email}`}>{email}</a>
                    </li>
                    <li>{address}</li>
                    <li>
                      <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="col-lg-6">
                <div
                  className="contact-right wow fadeInUp"
                  data-wow-delay=".4s"
                >
                  <h3>Send Us Message</h3>
                  <form
                    action="#"
                    id="contact-form"
                    method="POST"
                    className="contact-form-items"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div className="row g-4">
                      <div className="col-lg-6">
                        <div className="form-clt">
                          <input
                            type="text"
                            name="name"
                            id="name"
                            placeholder="Full Name"
                            required
                          />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="form-clt">
                          <input
                            type="text"
                            name="phone"
                            id="phone"
                            placeholder="Phone"
                            required
                          />
                        </div>
                      </div>
                      <div className="col-lg-12">
                        <div className="form-clt">
                          <input
                            type="text"
                            name="email"
                            id="email2"
                            placeholder="Your Email"
                            required
                          />
                        </div>
                      </div>
                      <div className="col-lg-12">
                        <div className="form-clt">
                          <textarea
                            name="message"
                            id="message"
                            placeholder="Comments"
                            defaultValue={""}
                            required
                          />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <button type="submit" className="theme-btn">
                          Send a Message
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Map Section Start */}
      <div className="map-section">
        <div className="map-items">
          <div className="googpemap">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7753.6!2d43.0766!3d11.4993!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3f1251c7b30d8a43%3A0x6f51ed2e14e61e0c!2sBalbala%2C%20Djibouti!5e0!3m2!1sen!2sdj!4v1700000000000!5m2!1sen!2sdj"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </NextLayout>
  );
};
export default Page;
