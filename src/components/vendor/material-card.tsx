"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type MaterialCardProps = {
  id: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
  selected: boolean;
  onClick: () => void;
};

export function MaterialCard({
  name,
  color,
  imageUrl,
  selected,
  onClick,
}: MaterialCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-white transition-all dark:bg-zinc-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-border hover:border-zinc-400 dark:hover:border-zinc-600",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
            className="object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            无图片
          </div>
        )}
      </div>
      <div className="px-2 py-2 text-left">
        <p className="truncate text-sm font-medium leading-tight">{name}</p>
        {color && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{color}</p>
        )}
      </div>
    </button>
  );
}
