'use client';

import { Image } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  ProductImage — renders real image or consistent placeholder         */
/* ------------------------------------------------------------------ */

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  lazy?: boolean;
}

export default function ProductImage({ src, alt, className, lazy }: ProductImageProps) {
  if (!src) {
    return (
      <div className={`ph-img${className ? ` ${className}` : ''}`} style={{position:'relative'}}>
        <Image size={32} style={{opacity:0.4}} />
      </div>
    );
  }

  return (
    <div className={`ph-img${className ? ` ${className}` : ''}`} style={{position:'relative'}}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={lazy ? 'lazy' : undefined}
        className="ph-img-inner"
      />
    </div>
  );
}
