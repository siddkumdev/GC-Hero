export default function LogoIcon({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer Map Pin to signify location-based civic issues */}
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      {/* Inner Lightning Bolt to signify action/heroism */}
      <polygon
        points="13 5 9 11 12 11 11 15 15 9 12 9"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
