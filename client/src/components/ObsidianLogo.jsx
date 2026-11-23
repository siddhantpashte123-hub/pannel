import React from 'react';

export default function ObsidianLogo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OBSIDIAN Logo"
    >
      <rect width="64" height="64" rx="16" fill="#000000" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="14.5"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.5"
      />
      <path
        d="M32 10L50 20.5V43.5L32 54L14 43.5V20.5L32 10Z"
        fill="#0B0B0F"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M32 10V32M32 32L50 20.5M32 32L14 20.5M32 32V54"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M32 10L50 20.5L32 32V10Z"
        fill="rgba(255,255,255,0.18)"
      />
      <path
        d="M25.5 28L30.5 32.5L25.5 37"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M33.5 37H39"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
