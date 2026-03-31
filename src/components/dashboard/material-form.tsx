"use client";

import { useState, useRef, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MATERIAL_CATEGORIES } from "@/lib/constants";

export type MaterialFormData = {
  id?: string;
  category: string;
  name: string;
  seriesCode: string;
  color: string;
  colorCode: string;
  promptModifier: string;
  imageUrl: string | null;
};

type MaterialFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: MaterialFormData;
  onSuccess: () => void;
};

export function MaterialForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: MaterialFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState(initialData?.category || "");
  const [preview, setPreview] = useState<string | null>(initialData?.imageUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const title = mode === "create" ? "添加材质" : "编辑材质";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const form = e.currentTarget;
      const fd = new FormData();

      fd.set("category", category);
      fd.set("name", (form.elements.namedItem("mat_name") as HTMLInputElement).value);
      fd.set("series_code", (form.elements.namedItem("series_code") as HTMLInputElement).value);
      fd.set("color", (form.elements.namedItem("color") as HTMLInputElement).value);
      fd.set("color_code", (form.elements.namedItem("color_code") as HTMLInputElement).value);
      fd.set("prompt_modifier", (form.elements.namedItem("prompt_modifier") as HTMLTextAreaElement).value);

      const file = fileRef.current?.files?.[0];
      if (file) {
        fd.set("image", file);
      } else if (mode === "create") {
        toast.error("请上传材质图片");
        setSubmitting(false);
        return;
      }

      const url =
        mode === "edit" && initialData?.id
          ? `/api/dashboard/materials/${initialData.id}`
          : "/api/dashboard/materials";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, { method, body: fd });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }

      toast.success(mode === "create" ? "材质已添加" : "材质已更新");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>分类 *</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)} required>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="mat_name">名称 *</Label>
            <Input
              id="mat_name"
              name="mat_name"
              required
              defaultValue={initialData?.name || ""}
              placeholder="例：莫兰迪灰"
            />
          </div>

          {/* Series Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="series_code">系列编号</Label>
              <Input
                id="series_code"
                name="series_code"
                defaultValue={initialData?.seriesCode || ""}
                placeholder="例：MLD-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color_code">色号</Label>
              <Input
                id="color_code"
                name="color_code"
                defaultValue={initialData?.colorCode || ""}
                placeholder="例：#8B8680"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="color">颜色描述</Label>
            <Input
              id="color"
              name="color"
              defaultValue={initialData?.color || ""}
              placeholder="例：灰色"
            />
          </div>

          {/* Prompt Modifier */}
          <div className="space-y-1.5">
            <Label htmlFor="prompt_modifier">AI 描述</Label>
            <Textarea
              id="prompt_modifier"
              name="prompt_modifier"
              rows={3}
              defaultValue={initialData?.promptModifier || ""}
              placeholder="用自然语言描述材质的外观和质感，AI 生成时会参考此描述"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label>材质图片{mode === "create" ? " *" : ""}</Label>
            <div
              className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border p-4 transition-colors hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <Image
                  src={preview}
                  alt="preview"
                  width={160}
                  height={160}
                  className="h-40 w-40 rounded-md object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">点击上传</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
