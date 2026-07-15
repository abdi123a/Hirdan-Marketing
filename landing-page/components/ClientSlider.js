"use client";
import { sliderProps } from "@/utility/sliderProps";
import { Swiper, SwiperSlide } from "swiper/react";
import { useSettings } from "@/components/SettingsProvider";

const ClientSlider = () => {
  const { landingPageContent, resolveImageUrl } = useSettings();
  const content = landingPageContent || {};
  const customLogos = content.clientLogos && content.clientLogos.length > 0 ? content.clientLogos : null;

  const defaultLogos = [
    "assets/img/brand/linkedIn.png",
    "assets/img/brand/dropbox.png",
    "assets/img/brand/trello.png",
    "assets/img/brand/framer.png",
    "assets/img/brand/shopify.png",
    "assets/img/brand/grammarly.png",
    "assets/img/brand/linkedIn.png",
    "assets/img/brand/dropbox.png",
    "assets/img/brand/trello.png",
    "assets/img/brand/framer.png",
    "assets/img/brand/shopify.png",
    "assets/img/brand/grammarly.png"
  ];

  const logosToRender = customLogos || defaultLogos;

  return (
    <Swiper {...sliderProps.brandSlider} className="swiper brand-slider">
      <div className="swiper-wrapper">
        {logosToRender.map((logo, index) => (
          <SwiperSlide key={index} className="swiper-slide">
            <div className="brand-image">
              <img src={customLogos ? resolveImageUrl(logo) : logo} alt={`brand-logo-${index}`} style={{ maxHeight: '60px', objectFit: 'contain' }} />
            </div>
          </SwiperSlide>
        ))}
      </div>
    </Swiper>
  );
};
export default ClientSlider;
