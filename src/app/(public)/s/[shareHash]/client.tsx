"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, Download, Share2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type RelatedMaterial = {
  id: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
};

type SharePageClientProps = {
  beforeImage: string;
  afterImage: string;
  materialName: string | null;
  materialColor: string | null;
  swatchUrl: string | null;
  orgName: string | null;
  orgSlug: string | null;
  orgLogoUrl: string | null;
  materialId: string | null;
  shareUrl: string;
  relatedMaterials: RelatedMaterial[];
};

// --------------------------------------------------------------------------
// Before/After Slider
// --------------------------------------------------------------------------
function BeforeAfterSlider({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setPosition(pct);
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    },
    [isDragging, updatePosition],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full cursor-col-resize select-none overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* After image (full) */}
      <Image
        src={after}
        alt="After"
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 640px"
        priority
        unoptimized
      />
      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <Image
          src={before}
          alt="Before"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 640px"
          priority
          unoptimized
        />
      </div>
      {/* Divider */}
      <div
        className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-md"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-zinc-700"
          >
            <path
              d="M4 8L1 5M4 8L1 11M4 8H12M12 8L15 5M12 8L15 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {/* Labels */}
      <span className="absolute top-3 left-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
        Before
      </span>
      <span className="absolute top-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
        After
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Client Component
// --------------------------------------------------------------------------
export default function SharePageClient({
  beforeImage,
  afterImage,
  materialName,
  materialColor,
  swatchUrl,
  orgName,
  orgSlug,
  orgLogoUrl,
  materialId,
  shareUrl,
  relatedMaterials,
}: SharePageClientProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("链接已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(afterImage);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `textura-${materialName || "result"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("下载失败");
    }
  }

  const tryUrl = orgSlug
    ? `/v/${orgSlug}${materialId ? `?material=${materialId}` : ""}`
    : "/";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Co-branding header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {orgLogoUrl ? (
              <Image
                src={orgLogoUrl}
                alt={orgName ?? ""}
                width={28}
                height={28}
                className="rounded-md"
                unoptimized
              />
            ) : orgName ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                {orgName.charAt(0)}
              </div>
            ) : null}
            {orgName && (
              <span className="text-sm font-semibold">{orgName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              &times; Textura
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            {copied ? (
              <Check className="mr-1 h-4 w-4" />
            ) : (
              <Share2 className="mr-1 h-4 w-4" />
            )}
            分享
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Before/After Comparison */}
        <section>
          <BeforeAfterSlider before={beforeImage} after={afterImage} />
        </section>

        {/* Material Info */}
        <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            {swatchUrl && (
              <Image
                src={swatchUrl}
                alt={materialName ?? "Swatch"}
                width={64}
                height={64}
                className="rounded-lg object-cover"
                unoptimized
              />
            )}
            <div className="flex-1 min-w-0">
              {materialName && (
                <h2 className="text-lg font-semibold truncate">
                  {materialName}
                </h2>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {materialColor && <span>{materialColor}</span>}
                {orgName && (
                  <>
                    {materialColor && <span>&middot;</span>}
                    <span>{orgName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={tryUrl}
            className={cn(buttonVariants({ size: "lg" }), "flex-1")}
          >
            用你的家具试试
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          {orgSlug && (
            <Link
              href={`/v/${orgSlug}${materialId ? `?material=${materialId}` : ""}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "flex-1",
              )}
            >
              申请样品
            </Link>
          )}
        </section>

        {/* Share Actions */}
        <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-zinc-900">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? (
                <Check className="mr-1 h-4 w-4" />
              ) : (
                <Copy className="mr-1 h-4 w-4" />
              )}
              复制链接
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />
              下载效果图
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            复制链接分享给朋友，在微信中打开可直接预览效果
          </p>
        </section>

        {/* Related Materials */}
        {relatedMaterials.length > 0 && orgSlug && (
          <section>
            <h3 className="mb-3 text-base font-semibold">
              {orgName ? `${orgName} 的更多材质` : "更多材质"}
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {relatedMaterials.map((m) => (
                <Link
                  key={m.id}
                  href={`/v/${orgSlug}?material=${m.id}`}
                  className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white transition-all hover:border-zinc-400 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {m.imageUrl ? (
                      <Image
                        src={m.imageUrl}
                        alt={m.name}
                        fill
                        sizes="25vw"
                        className="object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        --
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs font-medium">{m.name}</p>
                    {m.color && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.color}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <Link href="/" className="font-medium text-foreground hover:underline">
              Textura
            </Link>{" "}
            &mdash; AI 材质可视化平台
          </p>
        </footer>
      </main>
    </div>
  );
}
