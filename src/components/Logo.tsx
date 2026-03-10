import React from 'react'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ds-bg-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1c2a3a" />
          <stop offset="100%" stopColor="#0d1117" />
        </linearGradient>
        <linearGradient id="ds-accent-grad" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#79c0ff" />
          <stop offset="100%" stopColor="#58a6ff" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="32" height="32" rx="7" fill="url(#ds-bg-grad)" />

      {/* Subtle inner border */}
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="white" strokeOpacity="0.06" />

      {/* Header row background */}
      <rect x="4" y="4" width="24" height="8" rx="2" fill="#58a6ff" fillOpacity="0.18" />

      {/* Header row: terminal prompt ">" */}
      <text
        x="6.5"
        y="11"
        fontFamily="monospace"
        fontSize="6.5"
        fontWeight="700"
        fill="#58a6ff"
        letterSpacing="0.3"
      >
        &gt;_
      </text>

      {/* Vertical divider between row-num and content */}
      <line x1="4" y1="12" x2="28" y2="12" stroke="white" strokeOpacity="0.1" strokeWidth="1" />

      {/* Row separator lines */}
      <line x1="4" y1="18" x2="28" y2="18" stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      <line x1="4" y1="24" x2="28" y2="24" stroke="white" strokeOpacity="0.07" strokeWidth="1" />

      {/* Data bars — row 1 */}
      <rect x="6" y="14.5" width="14" height="2" rx="1" fill="white" fillOpacity="0.55" />

      {/* Data bars — row 2 */}
      <rect x="6" y="20.5" width="10" height="2" rx="1" fill="white" fillOpacity="0.35" />

      {/* Data bars — row 3 */}
      <rect x="6" y="26.5" width="17" height="2" rx="1" fill="white" fillOpacity="0.25" />

      {/* Accent dot on row 1 (selected cell indicator) */}
      <rect x="22" y="14" width="6" height="3" rx="1.5" fill="#58a6ff" fillOpacity="0.8" />
    </svg>
  )
}

export function LogoWordmark({ size = 32, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ height: size }}>
      <Logo size={size} />
      <span
        style={{ fontSize: size * 0.44, lineHeight: 1 }}
        className="font-bold tracking-tight text-ds-text"
      >
        Dev<span className="text-ds-accent">Sheets</span>
      </span>
    </div>
  )
}
