"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type InquiryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  materialName: string;
  generationId?: string;
  orgSlug: string;
};

type FormState = "idle" | "submitting" | "success";

export function InquiryModal({
  open,
  onOpenChange,
  materialId,
  materialName,
  generationId,
}: InquiryModalProps) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const resetForm = useCallback(() => {
    setContactName("");
    setPhone("");
    setCompany("");
    setMessage("");
    setFormState("idle");
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!contactName.trim()) {
        toast.error("请填写联系人姓名");
        return;
      }
      if (!phone.trim() || phone.trim().length < 5) {
        toast.error("请填写有效电话号码");
        return;
      }

      setFormState("submitting");

      try {
        const res = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            material_id: materialId,
            generation_id: generationId,
            contact_name: contactName.trim(),
            phone: phone.trim(),
            company: company.trim() || undefined,
            message: message.trim() || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "提交失败");
        }

        setFormState("success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "提交失败，请稍后重试";
        toast.error(msg);
        setFormState("idle");
      }
    },
    [materialId, generationId, contactName, phone, company, message],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {formState === "success" ? (
          <>
            <DialogHeader>
              <DialogTitle>提交成功</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="size-12 text-green-500" />
              <p className="text-center text-sm text-muted-foreground">
                您的样品申请已提交，供应商将尽快与您联系。
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>关闭</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>申请样品</DialogTitle>
              <DialogDescription>
                填写联系方式，申请 <strong>{materialName}</strong> 的样品
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inquiry-name">
                  联系人 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inquiry-name"
                  placeholder="您的姓名"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={formState === "submitting"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inquiry-phone">
                  电话 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inquiry-phone"
                  type="tel"
                  placeholder="手机号码"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={formState === "submitting"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inquiry-company">公司</Label>
                <Input
                  id="inquiry-company"
                  placeholder="公司名称（选填）"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={formState === "submitting"}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inquiry-message">备注</Label>
                <Textarea
                  id="inquiry-message"
                  placeholder="补充说明（选填）"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={formState === "submitting"}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={formState === "submitting"}>
                  {formState === "submitting" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                      提交中...
                    </>
                  ) : (
                    "提交申请"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
