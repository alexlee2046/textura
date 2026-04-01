"use client";

import Image, { type ImageProps } from "next/image";

interface SafeImageProps extends Omit<ImageProps, "src"> {
  src: string;
  fallbackSrc?: string;
}

export default function SafeImage({ src, fallbackSrc, alt, ...props }: SafeImageProps) {
  // Skip auto-fallback for priority images to avoid preloading the wrong format
  const jpgFallback = fallbackSrc ?? (src.endsWith(".webp") && !props.priority ? src.replace(/\.webp$/, ".jpg") : undefined);

  if (!jpgFallback) {
    return <Image src={src} alt={alt} {...props} />;
  }

  return (
    <picture>
      <source srcSet={src} type="image/webp" />
      <Image src={jpgFallback} alt={alt} {...props} />
    </picture>
  );
}
