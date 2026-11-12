'use client';

import { useEffect, useRef } from 'react';

export default function BadgeImg(props) {
  const ref = useRef(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const hide = () => {
      const link = img.closest('a');
      if (link) link.style.display = 'none';
    };
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) hide();
    img.addEventListener('error', hide);
    return () => img.removeEventListener('error', hide);
  }, []);
  return <img ref={ref} {...props} />;
}
