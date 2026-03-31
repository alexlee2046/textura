"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { login, register } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("common");
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    formData.set("next", next);

    startTransition(async () => {
      const action = mode === "login" ? login : register;
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {mode === "login" ? t("login") : t("register")}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "登录你的 Textura 账号"
              : "创建一个新的 Textura 账号"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
            {mode === "register" && (
              <div className="grid gap-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="你的姓名"
                  required
                  disabled={isPending}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="至少 6 位"
                minLength={6}
                required
                disabled={isPending}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {mode === "login" ? t("login") : t("register")}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                还没有账号？{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  {t("register")}
                </button>
              </>
            ) : (
              <>
                已有账号？{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  {t("login")}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
