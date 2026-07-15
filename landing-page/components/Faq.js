"use client";
import { useSettings } from "./SettingsProvider";

const Faq = () => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  const defaultFaqs = [
    { "question": "What size of business do you work with?", "answer": "All sizes — from independent shops to larger organizations." },
    { "question": "What platforms do you manage?", "answer": "Facebook, Instagram, TikTok, LinkedIn, Twitter/X, and YouTube Shorts, depending on your package." },
    { "question": "What does it cost to get started?", "answer": "Our Starter Package begins at 120,000 FDJ/month." },
    { "question": "Do you offer content in multiple languages?", "answer": "Yes — tailored to whichever your audience responds to best." },
    { "question": "Do I need a website, or is social media enough?", "answer": "Depends on your goals — we'll give an honest recommendation." },
    { "question": "How do you measure success?", "answer": "A monthly report showing what was done and how it performed." }
  ];

  const faqs = content.faqsJson && content.faqsJson.length > 0 ? content.faqsJson : defaultFaqs;

  return (
    <section className="faq-section section-padding">
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            Some Questions
          </span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="faq-content">
              <div className="faq-accordion">
                <div className="accordion" id="accordion">
                  {faqs.map((faq, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div
                        key={idx}
                        className="accordion-item wow fadeInUp"
                        data-wow-delay={`${0.2 * (idx % 4 + 1)}s`}
                      >
                        <h4 className="accordion-header">
                          <button
                            className={`accordion-button ${isFirst ? "" : "collapsed"}`}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#faq${idx}`}
                            aria-expanded={isFirst ? "true" : "false"}
                            aria-controls={`faq${idx}`}
                          >
                            {faq.question}
                          </button>
                        </h4>
                        <div
                          id={`faq${idx}`}
                          className={`accordion-collapse collapse ${isFirst ? "show" : ""}`}
                          data-bs-parent="#accordion"
                        >
                          <div className="accordion-body">
                            {faq.answer}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Faq;
