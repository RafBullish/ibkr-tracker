import { useSyncExternalStore } from 'react';

const getServerSnapshot = () => false;

export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    getServerSnapshot
  );
}
