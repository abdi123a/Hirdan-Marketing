"use client";
import { useSettings } from "./SettingsProvider";
import Counter from "./Counter";

const FunFactCounter = ({ style }) => {
  const { landingPageContent } = useSettings();
  const content = landingPageContent || {};

  const defaultStats = [
    "15+ Businesses We've Worked With",
    "8+ Years Of Industry Experience",
    "6 Core Services",
    "3 Packages To Fit Any Budget"
  ];

  const stats = content.aboutStatsJson && content.aboutStatsJson.length > 0 ? content.aboutStatsJson : defaultStats;

  return (
    <div className="row">
      {stats.map((stat, idx) => {
        const firstSpace = stat.indexOf(" ");
        const countStr = firstSpace !== -1 ? stat.substring(0, firstSpace) : stat;
        const label = firstSpace !== -1 ? stat.substring(firstSpace + 1) : "";

        const numberOnly = parseInt(countStr.replace(/[^0-9]/g, "")) || 0;
        const suffix = countStr.replace(/[0-9]/g, "");

        return (
          <div key={idx} className="col-xl-3 col-lg-4 col-md-6 wow fadeInUp" data-wow-delay={`${0.2 * (idx + 1)}s`}>
            <div className={`funfact-box-items ${idx === 1 ? "active" : `style-${style}`}`}>
              <h2>
                <span className="count">
                  <Counter end={numberOnly} />
                </span>
                {suffix}
              </h2>
              <h6>{label}</h6>
              <p>Hirdan Marketing</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default FunFactCounter;
