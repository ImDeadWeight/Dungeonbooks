/**
 * @file Custom combat-state icons: crossed swords (active) and side-by-side
 * swords (inactive), in the white outline style.
 */
/** Icon size in pixels. */
interface Props {
  size?: number;
}

/** Shared outline style matching the lucide icons. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** One sword drawn pointing up, centred at x = 0; callers rotate/translate it. */
function Sword() {
  return (
    <>
      <path d="M0 -10 L1.6 -7.5 L1.6 4 L-1.6 4 L-1.6 -7.5 Z" />
      <path d="M-4 4 H4" />
      <path d="M0 4 V8.5" />
      <circle cx="0" cy="10" r="1.2" />
    </>
  );
}

/** Active combat. */
export function CrossedSwordsIcon({ size = 24 }: Props) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" {...stroke} aria-label="Combat active">
      <g transform="rotate(-40) scale(0.95)"><Sword /></g>
      <g transform="rotate(40) scale(0.95)"><Sword /></g>
    </svg>
  );
}

/** Combat inactive: two swords side by side. */
export function SheathedSwordsIcon({ size = 24 }: Props) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" {...stroke} aria-label="Combat inactive">
      <g transform="translate(-4.5 0) scale(0.95)"><Sword /></g>
      <g transform="translate(4.5 0) scale(0.95)"><Sword /></g>
    </svg>
  );
}
