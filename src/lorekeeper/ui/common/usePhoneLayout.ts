/**
 * @file Whether the screen is phone-sized, kept current as it rotates or the
 * window is resized.
 */
import { useEffect, useState } from 'react';
import { isPhoneLayout, PHONE_MAX_WIDTH } from '../../../platform';

/** True on phone-sized screens (one panel at a time; pages as a single column). */
export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(isPhoneLayout);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}
