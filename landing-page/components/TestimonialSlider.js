"use client";
import { sliderProps } from "@/utility/sliderProps";
import { Swiper, SwiperSlide } from "swiper/react";
import { useSettings } from "./SettingsProvider";

const defaultTestimonials = [
  {
    name: "Ahmed Ali",
    role: "Founder, Djibouti Cafe",
    feedback: "Hirdan Marketing helped us launch our online presence. Our engagement and local traffic increased dramatically in just 2 months!",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Mariam Omar",
    role: "Operations Director, East Africa Logistics",
    feedback: "Professional, prompt, and result-oriented team. Their copywriting and branding services are top-notch.",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Youssef Hassan",
    role: "Owner, Barwaqo Retail",
    feedback: "Great experience working with them. Clear reporting and consistent posting made managing our social channels effortless.",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Hodan Nour",
    role: "CEO, Nour Group",
    feedback: "Our brand presence has grown tremendously since we partnered with Hirdan Marketing. Highly recommended!",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Faisal Ibrahim",
    role: "Marketing Manager, DjibPharma",
    feedback: "They truly understand the local market. Our campaigns have been much more effective and targeted.",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Sahra Duale",
    role: "Owner, Sahra Fashion",
    feedback: "Our Instagram presence went from zero to hundreds of genuine followers in just one month. Amazing team!",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Omar Abdi",
    role: "Director, Horn Investment Group",
    feedback: "The strategy they built for us was exactly what we needed. Results speak for themselves.",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  },
  {
    name: "Ifrah Hassan",
    role: "Manager, Djibouti Events Hub",
    feedback: "Consistent content, beautiful visuals, and a team that actually cares about your goals. Highly recommended.",
    rating: 5,
    avatarUrl: "assets/img/testimonial/client.png"
  }
];

export const TestimonialSlider1 = () => {
  const { testimonials, resolveImageUrl } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <Swiper {...sliderProps.testimonialSlider} className="swiper testimonial-slider">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className="testimonial-content">
              <p>{item.feedback}</p>
              <div className="author-items">
                <div className="author-image">
                  <img src={resolveImageUrl(item.avatarUrl) || "assets/img/testimonial/client.png"} alt="author-img" />
                  <div className="content">
                    <h5>
                      {item.name} / <span>{item.role}</span>
                    </h5>
                  </div>
                </div>
                <img src="assets/img/testimonial/icon.png" alt="img" />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </div>
      <div className="swiper-dot pt-5 ps-1">
        <div className="dot" />
      </div>
    </Swiper>
  );
};

export const TestimonialSlider2 = ({ style = "style-1" }) => {
  const { testimonials, resolveImageUrl } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  const bgImages = [
    "assets/img/testimonial/client-2.png",
    "assets/img/testimonial/client-3.png"
  ];

  return (
    <Swiper {...sliderProps.testimonialSlider2} className="swiper testimonial-slider-2">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className={`testimonial-card-items ${style}`}>
              <div className="testimonial-image">
                <img src={bgImages[idx % bgImages.length]} alt="img" />
              </div>
              <div className="testimonial-content">
                <div className="author-image">
                  <img src={resolveImageUrl(item.avatarUrl) || "assets/img/testimonial/client.png"} alt="author-img" />
                  <div className="content">
                    <h5>
                      {item.name} <span>/{item.role}</span>
                    </h5>
                  </div>
                </div>
                <p>{item.feedback}</p>
                <div className="star">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <i key={i} className="fas fa-star" />
                  ))}
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </div>
      <div className="swiper-dot pb-5 text-center">
        <div className="dot" />
      </div>
    </Swiper>
  );
};

export const TestimonialSlider3 = () => {
  const { testimonials, resolveImageUrl } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <Swiper {...sliderProps.testimonialSlider3} className="swiper testimonial-slider-3">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className="testimonial-content">
              <div className="author-image">
                <img src={resolveImageUrl(item.avatarUrl) || "assets/img/testimonial/client.png"} alt="author-img" />
                <div className="content">
                  <h5>
                    {item.name} / <span>{item.role}</span>
                  </h5>
                </div>
              </div>
              <p>"{item.feedback}"</p>
              <div className="star">
                {Array.from({ length: item.rating || 5 }).map((_, i) => (
                  <i key={i} className="fas fa-star" />
                ))}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </div>
      <div className="swiper-dot-2 pt-3 ps-1">
        <div className="dot" />
      </div>
    </Swiper>
  );
};

export const TestimonialSlider4 = () => {
  const { testimonials, resolveImageUrl } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <Swiper {...sliderProps.testimonialSlider4} className="swiper testimonial-slider-4">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className="testimonial-box-items">
              <div className="testimonial-content">
                <div className="author-image">
                  <img src={resolveImageUrl(item.avatarUrl) || "assets/img/testimonial/client.png"} alt="author-img" />
                  <div className="content">
                    <h5>
                      {item.name} <span>/{item.role}</span>
                    </h5>
                  </div>
                </div>
                <p>{item.feedback}</p>
                <div className="star">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <i key={i} className="fas fa-star" />
                  ))}
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </div>
    </Swiper>
  );
};

export const TestimonialSlider5 = () => {
  const { testimonials, resolveImageUrl } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <Swiper {...sliderProps.testimonialSlider5} className="swiper testimonial-slider-5">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className="testimonial-box-items">
              <div className="testimonial-content">
                <div className="author-image">
                  <img src={resolveImageUrl(item.avatarUrl) || "assets/img/testimonial/client.png"} alt="author-img" />
                  <div className="content">
                    <h5>
                      {item.name} <span>/{item.role}</span>
                    </h5>
                  </div>
                </div>
                <p>{item.feedback}</p>
                <div className="star">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <i key={i} className="fas fa-star" />
                  ))}
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </div>
    </Swiper>
  );
};

export const TestiThumbSlider = () => {
  const thumbImages = [
    "assets/img/home-6/testimonial/01.png",
    "assets/img/home-6/testimonial/02.png",
    "assets/img/home-6/testimonial/03.png",
    "assets/img/home-6/testimonial/04.png",
    "assets/img/home-6/testimonial/05.png",
    "assets/img/home-6/testimonial/01.png",
    "assets/img/home-6/testimonial/02.png",
    "assets/img/home-6/testimonial/03.png",
    "assets/img/home-6/testimonial/04.png",
    "assets/img/home-6/testimonial/05.png",
  ];
  return (
    <Swiper {...sliderProps.testiThumbSlider} className="swiper testi-thumb-slider">
      <div className="swiper-wrapper">
        {thumbImages.map((src, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div
              className="testi-thumb bg-cover"
              style={{ backgroundImage: `url("${src}")` }}
            />
          </SwiperSlide>
        ))}
      </div>
    </Swiper>
  );
};

export const TestiContentSlider = () => {
  const { testimonials } = useSettings();
  const items = testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials;

  return (
    <Swiper {...sliderProps.testiContentSlider} className="swiper testi-content-slider">
      <div className="swiper-wrapper">
        {items.map((item, idx) => (
          <SwiperSlide key={idx} className="swiper-slide">
            <div className="content">
              <h3>
                {item.name} <span>/ {item.role}</span>
              </h3>
              <h4>{item.feedback}</h4>
            </div>
          </SwiperSlide>
        ))}
      </div>
    </Swiper>
  );
};
