"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrgContext } from "@/components/dashboard/dashboard-context";
import { MEMBER_ROLE } from "@/lib/constants";

type OrgSettings = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  contactEmail: string | null;
  notifyEmail: string | null;
  wechatQr: string | null;
};

export default function SettingsPage() {
  const org = useOrgContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  // Image previews
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [wechatQrPreview, setWechatQrPreview] = useState<string | null>(null);

  // File refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const wechatQrInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [wechatQrFile, setWechatQrFile] = useState<File | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OrgSettings = await res.json();
      setName(data.name);
      setDescription(data.description ?? "");
      setContactEmail(data.contactEmail ?? "");
      setNotifyEmail(data.notifyEmail ?? "");
      setLogoPreview(data.logoUrl);
      setWechatQrPreview(data.wechatQr);
    } catch {
      toast.error("加载设置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("组织名称不能为空");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("contactEmail", contactEmail);
      formData.append("notifyEmail", notifyEmail);
      if (logoFile) formData.append("logo", logoFile);
      if (wechatQrFile) formData.append("wechatQr", wechatQrFile);

      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }

      const updated: OrgSettings = await res.json();
      setLogoPreview(updated.logoUrl);
      setWechatQrPreview(updated.wechatQr);
      setLogoFile(null);
      setWechatQrFile(null);
      toast.success("设置已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const isOwner = org.role === MEMBER_ROLE.OWNER;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">组织设置</h1>
        <p className="text-sm text-muted-foreground">
          管理组织基本信息和联系方式
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">组织名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner}
                placeholder="输入组织名称"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">组织标识</Label>
              <Input id="slug" value={org.orgSlug} disabled />
              <p className="text-xs text-muted-foreground">
                组织标识创建后不可更改
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">组织简介</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isOwner}
                placeholder="简要描述您的组织"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">联系方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">联系邮箱</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={!isOwner}
                placeholder="对外展示的联系邮箱"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notifyEmail">通知邮箱</Label>
              <Input
                id="notifyEmail"
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                disabled={!isOwner}
                placeholder="接收询盘通知的邮箱"
              />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">品牌形象</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>组织 Logo</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-xs text-muted-foreground">
                    Logo
                  </div>
                )}
                {isOwner && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      上传 Logo
                    </Button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileChange(e, setLogoFile, setLogoPreview)
                      }
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                建议尺寸 256x256，支持 PNG / JPG
              </p>
            </div>

            {/* WeChat QR */}
            <div className="space-y-2">
              <Label>微信二维码</Label>
              <div className="flex items-start gap-4">
                {wechatQrPreview ? (
                  <Image
                    src={wechatQrPreview}
                    alt="WeChat QR"
                    width={120}
                    height={120}
                    className="h-30 w-30 rounded-lg border border-border object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-30 w-30 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-xs text-muted-foreground">
                    二维码
                  </div>
                )}
                {isOwner && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => wechatQrInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      上传二维码
                    </Button>
                    <input
                      ref={wechatQrInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileChange(e, setWechatQrFile, setWechatQrPreview)
                      }
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                上传微信二维码图片，将展示在供应商页面
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        {isOwner && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        )}

        {!isOwner && (
          <p className="text-center text-sm text-muted-foreground">
            仅组织所有者可以修改设置
          </p>
        )}
      </form>
    </div>
  );
}
