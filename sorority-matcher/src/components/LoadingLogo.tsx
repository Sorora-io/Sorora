interface LoadingLogoProps {
  size?: number;
  className?: string;
}

// The jade/gold circles from the brand mark, orbiting around the center
// dot — every half turn the two colors have swapped sides.
const LoadingLogo = ({ size = 40, className = '' }: LoadingLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    className={className}
    role="status"
    aria-label="Loading"
  >
    <g className="animate-logo-spin" style={{ transformOrigin: '20px 20px' }}>
      <circle cx="13" cy="20" r="9" fill="#DCEDE8" />
      <circle cx="27" cy="20" r="9" fill="#F2E6C6" />
    </g>
    <circle cx="20" cy="20" r="4" fill="#296F62" />
  </svg>
);

export default LoadingLogo;
