import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to trigger a color flash effect when a value changes.
 * @param value The value to monitor for changes.
 * @returns { flashClass: string } - A Tailwind class that applies the flash color.
 */
export function useFlash(value: number | string) {
  const [flashClass, setFlashClass] = useState('');
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      if (typeof value === 'number' && typeof prevValue.current === 'number') {
        const isUp = value > prevValue.current;
        setFlashClass(isUp ? 'text-emerald-500' : 'text-rose-500');
      } else {
        setFlashClass('text-primary');
      }

      const timer = setTimeout(() => {
        setFlashClass('');
      }, 800);

      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return { flashClass };
}
