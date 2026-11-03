/**
 * @file The filled band-aid icon used for Conditions, copied from the Android
 * app (Material Icons "Healing", Apache 2.0) so both apps match.
 */
/** Icon size in pixels. */
interface Props {
  size?: number;
}

const HEALING_PATH =
  'M17.73 12.02l3.98-3.98c.39-.39.39-1.02 0-1.41l-4.34-4.34c-.39-.39-1.02-.39-1.41 0l-3.98 3.98L8 2.29C7.8 2.1 7.55 2 7.29 2c-.25 0-.51.1-.7.29L2.25 6.63c-.39.39-.39 1.02 0 1.41l3.98 3.98L2.25 16c-.39.39-.39 1.02 0 1.41l4.34 4.34c.39.39 1.02.39 1.41 0l3.98-3.98 3.98 3.98c.2.2.45.29.71.29.26 0 .51-.1.71-.29l4.34-4.34c.39-.39.39-1.02 0-1.41l-3.99-3.98z' +
  'M12 9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z' +
  'M7.29 10.96L3.66 7.34l3.63-3.63 3.62 3.62-3.62 3.63z' +
  'M10 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z' +
  'M12 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z' +
  'M14 11c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z' +
  'M16.66 20.34l-3.63-3.62 3.63-3.63 3.62 3.62-3.62 3.63z';

/** Conditions: a filled band-aid, tinted by the current text colour. */
export function HealingIcon({ size = 24 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={HEALING_PATH} />
    </svg>
  );
}
