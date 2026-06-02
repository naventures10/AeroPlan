import { useState, useEffect } from 'react';

/**
 * Custom hook to delay the unmounting of a component or layer.
 *
 * When `isActive` changes to `true`, the hook immediately returns `true`.
 * When `isActive` changes to `false`, the hook waits `delayMs` before returning `false`.
 * This allows exit animations to complete before unmounting.
 *
 * @param isActive Current active state
 * @param delayMs Delay in milliseconds before unmounting
 * @returns boolean indicating if the element should still be mounted
 */
export function useDelayedUnmount(isActive: boolean, delayMs: number): boolean {
  const [isRendered, setIsRendered] = useState(isActive);

  useEffect(() => {
    let timeoutId: number;

    if (isActive) {
      setIsRendered(true);
    } else {
      timeoutId = window.setTimeout(() => setIsRendered(false), delayMs);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, delayMs]);

  return isRendered;
}
