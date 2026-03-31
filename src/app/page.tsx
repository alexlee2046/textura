import { getOptionalUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { MEMBER_STATUS } from "@/lib/constants";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const user = await getOptionalUser();

  if (user) {
    const member = await prisma.organizationMember.findFirst({
      where: { userId: user.userId, status: MEMBER_STATUS.ACTIVE },
    });

    if (member) redirect("/dashboard");
    redirect("/onboarding");
  }

  // Anonymous: render landing page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight">Textura</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          AI 材质可视化平台
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/v/elastron"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            查看演示
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            厂商入驻
          </Link>
        </div>

        <Link
          href="/login"
          className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          已有账号？登录
        </Link>
      </div>
    </div>
  );
}
