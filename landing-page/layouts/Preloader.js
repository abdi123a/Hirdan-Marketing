"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";

const Preloader = () => {
  const { settings, resolveImageUrl, isLoading } = useSettings();
  console.log("[DEBUG Preloader] render: isLoading =", isLoading, "settings =", settings);
  const [cachedSettings, setCachedSettings] = useState(null);
  const [fade, setFade] = useState(false);
  const [visible, setVisible] = useState(true);

  // Read settings from cache on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("agency_settings");
      if (cached) {
        try {
          setCachedSettings(JSON.parse(cached));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // Handle transition and cleanup immediately when isLoading is false
  useEffect(() => {
    if (!isLoading) {
      setFade(true);
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 600); // Wait for fade out transition
      return () => clearTimeout(hideTimer);
    }
  }, [isLoading]);

  if (!visible) return null;

  const currentSettings = settings || cachedSettings;
  const logo = currentSettings ? resolveImageUrl(currentSettings.whiteLogo || currentSettings.logo) : "";
  const agencyName = currentSettings?.agencyName || "Hirdan Marketing";

  return (
    <div
      id="preloader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff", // Pure light background
        opacity: fade ? 0 : 1,
        transition: "opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
        pointerEvents: fade ? "none" : "all",
      }}
    >
      <style>{`
        @keyframes pulseLogo {
          0%, 100% {
            transform: scale(0.95);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
            filter: drop-shadow(0 0 15px rgba(80, 65, 136, 0.15));
          }
        }
        .pulsing-logo {
          animation: pulseLogo 2s infinite ease-in-out;
        }
      `}</style>

      {/* Pulsing Logo in Center */}
      <div 
        className="pulsing-logo"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <img
          src={logo || "assets/img/logo/hirdan-logo.png"}
          alt={agencyName}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "assets/img/logo/hirdan-logo.png";
          }}
          style={{
            maxHeight: "80px",
            maxWidth: "240px",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
};

export default Preloader;
