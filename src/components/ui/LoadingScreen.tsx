import React from 'react';

interface LoadingScreenProps {
  fadeOut?: boolean;
}

const AnimatedLogo = () => (
  <div className="relative flex items-center justify-center">
    {/* Rich Professional Backglow - Visible Atmosphere */}
    <div
      className="absolute bg-[#f5b21a]/20 rounded-full blur-[90px] animate-pulse-slow pointer-events-none"
      style={{ width: '420px', height: '420px' }}
    />

    {/* Rich Professional Backglow - Concentrated core */}
    <div
      className="absolute bg-[#f5b21a]/35 rounded-full blur-[50px] animate-pulse-slow pointer-events-none"
      style={{ width: '240px', height: '240px', animationDelay: '150ms' }}
    />

    <svg
      width="180"
      height="180"
      viewBox="-150 -150 900 960"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative z-10 overflow-visible"
    >
      {/* Yellow Circle - Pulsing with z-depth shadow */}
      <circle
        cx="300.12"
        cy="360.72"
        r="300.12"
        fill="#f5b21a"
        className="animate-pulse-slow origin-center duration-[3000ms]"
        style={{
          filter: 'drop-shadow(0 0 50px rgba(245, 178, 26, 0.45))'
        }}
      />

      {/* Purple 'H' - Solid & Static */}
      <polygon
        fill="#504289"
        points="402.6 0 402.6 259.7 202.26 259.7 202.26 0 74.89 0 74.89 518.16 202.26 518.16 202.26 376.09 402.6 376.09 402.6 518.16 529.98 518.16 529.98 0 402.6 0"
      />
    </svg>
  </div>
);

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fadeOut = false }) => {
  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-1000 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Pure professional background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/5 opacity-80" />

      <div className="relative flex items-center justify-center animate-fade-in">
        <AnimatedLogo />
      </div>
    </div>
  );
};
