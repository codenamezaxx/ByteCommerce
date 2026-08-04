'use client';

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
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.4}}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
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
