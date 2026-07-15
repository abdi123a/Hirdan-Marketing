"use client";
import { useSettings } from "./SettingsProvider";

const WorkingProcess = () => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  return (
    <section className="working-section-2 section-padding">
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            {content.processSubtitle || "How We Work"}
          </span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            {content.processTitle || "A Process Built On Strategy, Not Guesswork"}
          </h2>
        </div>
        <div className="row align-items-center justify-content-between">
          <div className="col-lg-8 wow fadeInUp" data-wow-delay=".3s">
            <div className="working-card-items">
              <div className="icon">
                <img src="assets/img/working-process/icon-1.png" alt="img" />
              </div>
              <div className="content">
                <span className="sub-title">Step 01</span>
                <h3>{content.process1Title || "Discovery"}</h3>
                <p>{content.process1Desc || "We start by understanding your business, your audience, and your goals."}</p>
              </div>
            </div>
          </div>
          <div className="col-lg-3 wow fadeInUp" data-wow-delay=".5s">
            <div className="arrow-image">
              <img src="assets/img/working-process/arrow-down.png" alt="img" />
            </div>
          </div>
          <div className="col-lg-3 wow fadeInUp" data-wow-delay=".3s">
            <div className="arrow-image text-center">
              <img
                src="assets/img/working-process/arrow-revers.png"
                alt="img"
              />
            </div>
          </div>
          <div className="col-lg-8 wow fadeInUp" data-wow-delay=".5s">
            <div className="working-card-items">
              <div className="content">
                <span className="sub-title">Step 02</span>
                <h3>{content.process2Title || "Strategy"}</h3>
                <p>{content.process2Desc || "We build a plan tailored to your brand and your market."}</p>
              </div>
              <div className="icon">
                <img src="assets/img/working-process/icon-2.png" alt="img" />
              </div>
            </div>
          </div>
          <div className="col-lg-8 wow fadeInUp" data-wow-delay=".3s">
            <div className="working-card-items">
              <div className="icon">
                <img src="assets/img/working-process/icon-3.png" alt="img" />
              </div>
              <div className="content">
                <span className="sub-title">Step 03</span>
                <h3>{content.process3Title || "Content & Publishing"}</h3>
                <p>{content.process3Desc || "We create and publish consistently, on the platforms that matter most."}</p>
              </div>
            </div>
          </div>
          <div className="col-lg-3 wow fadeInUp" data-wow-delay=".5s">
            <div className="arrow-image">
              <img src="assets/img/working-process/arrow-down.png" alt="img" />
            </div>
          </div>
          <div className="col-lg-3 wow fadeInUp" data-wow-delay=".3s">
            <div className="arrow-image text-center">
              <img
                src="assets/img/working-process/arrow-revers.png"
                alt="img"
              />
            </div>
          </div>
          <div className="col-lg-8 wow fadeInUp" data-wow-delay=".5s">
            <div className="working-card-items">
              <div className="content">
                <span className="sub-title">Step 04</span>
                <h3>{content.process4Title || "Reporting"}</h3>
                <p>{content.process4Desc || "Every month, you receive a clear report on performance and next steps."}</p>
              </div>
              <div className="icon">
                <img src="assets/img/working-process/icon-4.png" alt="img" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default WorkingProcess;

export const WorkingProcess2 = () => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  const steps = [
    { title: content.process1Title || "Discovery", desc: content.process1Desc || "We start by understanding your business, your audience, and your goals." },
    { title: content.process2Title || "Strategy", desc: content.process2Desc || "We build a plan tailored to your brand and your market." },
    { title: content.process3Title || "Content & Publishing", desc: content.process3Desc || "We create and publish consistently, on the platforms that matter most." },
    { title: content.process4Title || "Reporting", desc: content.process4Desc || "Every month, you receive a clear report on performance and next steps." }
  ];

  return (
    <section className="working-process-section section-padding pt-0">
      <div className="container">
        <div className="section-title text-center">
          <span className="sub-content wow fadeInUp">
            <img src="assets/img/bale.png" alt="img" />
            {content.processSubtitle || "How We Work"}
          </span>
          <h2 className="wow fadeInUp" data-wow-delay=".3s">
            {content.processTitle || "A Process Built On Strategy, Not Guesswork"}
          </h2>
        </div>
        <div className="work-process-wrapper">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="work-process-content">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="work-process-items wow fadeInUp"
                    data-wow-delay={`${0.2 * (idx + 1)}s`}
                  >
                    <div className="digit-box">0{idx + 1}</div>
                    <h4>{step.title}</h4>
                    <p>{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-6">
              <div
                className="work-process-image wow fadeInUp"
                data-wow-delay=".4s"
              >
                <img src="assets/img/business-mens-grsl.jpg" alt="img" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
