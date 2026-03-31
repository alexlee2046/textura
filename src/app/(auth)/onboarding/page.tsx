import { getAuthUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { MEMBER_STATUS } from "@/lib/constants";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, LogOut } from "lucide-react";
import { LogoutButton } from "./logout-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "加入组织 — Textura",
};

export default async function OnboardingPage() {
  const { userId } = await getAuthUser();

  // If user already has an active org, skip to dashboard
  const member = await prisma.organizationMember.findFirst({
    where: { userId, status: MEMBER_STATUS.ACTIVE },
  });
  if (member) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4 text-xl">你还没有加入任何组织</CardTitle>
          <CardDescription>
            请联系平台管理员获取邀请，或申请厂商入驻
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">如果你是材料厂商：</p>
            <p className="mt-1 text-muted-foreground">
              请发送邮件至{" "}
              <a
                href="mailto:hi@textura.ai"
                className="font-medium text-foreground underline underline-offset-4"
              >
                hi@textura.ai
              </a>{" "}
              申请入驻，注明公司名称和联系方式。
            </p>
          </div>

          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">如果你已收到邀请：</p>
            <p className="mt-1 text-muted-foreground">
              请联系邀请你的管理员完成组织绑定。
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              返回首页
            </Link>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
