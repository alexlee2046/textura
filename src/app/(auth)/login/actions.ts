"use server";

import { createClient } from "@/lib/supabase/server";
import { syncOrgClaims } from "@/lib/dal";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "请输入有效的邮箱和密码" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "邮箱或密码错误" };

  if (data.user) await syncOrgClaims(data.user.id);

  const next = formData.get("next") as string;
  redirect(next || "/dashboard");
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: "请填写完整信息" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name } },
  });
  if (error) return { error: error.message };

  if (data.user) await syncOrgClaims(data.user.id);

  const next = formData.get("next") as string;
  redirect(next || "/onboarding");
}
