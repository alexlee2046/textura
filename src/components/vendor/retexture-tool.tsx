"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Sparkles, Download, Share2, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "./before-after-slider";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RetextureToolProps = {
  selectedMaterial: {
    id: string;
    name: string;
    color: string | null;
    imageUrl: string | null;
  } | null;
};

type ToolState = "idle" | "uploading" | "ready" | "generating" | "result";

type GenerationResult = {
  imageUrl: string;
  shareHash: string;
  materialName: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function RetextureTool({
  selectedMaterial,
}: RetextureToolProps) {
  const [state, setState] = useState<ToolState>("idle");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive readiness: image uploaded + material selected
  const isReady =
    state !== "generating" &&
    state !== "uploading" &&
    !!uploadedFile &&
    !!selectedMaterial;

  // ---- File handling -------------------------------------------------------
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("图片不能超过 5MB");
      return;
    }

    setState("uploading");
    try {
      const compressed = await compressImage(file);
      setUploadedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setResult(null);
      setState("ready");
    } catch {
      toast.error("图片处理失败，请重试");
      setState("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const clearImage = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setState("idle");
  }, [previewUrl]);

  // ---- Generate ------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!uploadedFile || !selectedMaterial) return;

    setState("generating");
    try {
      const formData = new FormData();
      formData.append("image", uploadedFile);
      formData.append("material_id", selectedMaterial.id);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "生成失败");
      }

      setResult({
        imageUrl: data.imageUrl,
        shareHash: data.shareHash,
        materialName: data.materialName,
      });
      setState("result");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "生成失败，请稍后重试";
      toast.error(message);
      setState("ready");
    }
  }, [uploadedFile, selectedMaterial]);

  // ---- Download (requires auth) --------------------------------------------
  const handleDownload = useCallback(async () => {
    if (!result) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.info("登录后即可下载高清原图", {
        action: {
          label: "去登录",
          onClick: () => {
            window.location.href = "/login";
          },
        },
      });
      return;
    }

    // Trigger download
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `textura-${result.materialName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result]);

  // ---- Share ---------------------------------------------------------------
  const handleShare = useCallback(async () => {
    if (!result) return;

    const shareUrl = `${window.location.origin}/s/${result.shareHash}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("链接已复制");
    } catch {
      // Fallback for environments without clipboard API
      toast.info(shareUrl);
    }
  }, [result]);

  // ---- Render --------------------------------------------------------------
  return (
    <div className="mt-6 space-y-4">
      {state === "result" && result && previewUrl ? (
        // Result view with before/after slider
        <div className="space-y-3">
          <BeforeAfterSlider
            beforeSrc={previewUrl}
            afterSrc={result.imageUrl}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4" data-icon="inline-start" />
              下载
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="size-4" data-icon="inline-start" />
              分享
            </Button>
            <Button variant="ghost" size="sm" onClick={clearImage}>
              重新上传
            </Button>
          </div>
        </div>
      ) : (
        // Upload / preview / generate view
        <div className="space-y-3">
          {/* Upload area or preview */}
          {!previewUrl ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="上传家具图片"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600",
                state === "uploading" && "pointer-events-none opacity-60",
              )}
            >
              {state === "uploading" ? (
                <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-600" />
              ) : (
                <Upload className="size-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {state === "uploading" ? "处理中..." : "上传家具图片"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  拖拽或点击上传，支持 JPG/PNG，最大 5MB
                </p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg">
              <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={previewUrl}
                  alt="Uploaded furniture"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <button
                type="button"
                onClick={clearImage}
                aria-label="移除图片"
                className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Selected material indicator */}
          {selectedMaterial && (
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              {selectedMaterial.imageUrl ? (
                <Image
                  src={selectedMaterial.imageUrl}
                  alt={selectedMaterial.name}
                  width={36}
                  height={36}
                  className="rounded border border-border object-cover"
                />
              ) : (
                <div className="flex size-9 items-center justify-center rounded border border-border bg-zinc-200 dark:bg-zinc-700">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedMaterial.name}
                </p>
                {selectedMaterial.color && (
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedMaterial.color}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Generate button */}
          <Button
            size="lg"
            disabled={!isReady}
            onClick={handleGenerate}
            className={cn(
              "relative w-full overflow-hidden",
              state === "generating" && "pointer-events-none",
            )}
          >
            {state === "generating" ? (
              <>
                <span className="absolute inset-0 animate-pulse bg-primary/80" />
                <span className="relative flex items-center gap-2">
                  <Sparkles className="size-4 animate-spin" />
                  AI 生成中...
                </span>
              </>
            ) : (
              <>
                <Sparkles className="size-4" data-icon="inline-start" />
                {!uploadedFile
                  ? "上传图片开始体验"
                  : !selectedMaterial
                    ? "请先选择材质"
                    : "AI 换材"}
              </>
            )}
          </Button>

          {/* Hint text for empty state */}
          {state === "idle" && !selectedMaterial && (
            <p className="text-center text-xs text-muted-foreground">
              上传家具照片，选择下方材质，一键 AI 换材
            </p>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  );
}
