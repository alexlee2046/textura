import { SITE_URL } from "@/lib/constants";

export async function revalidateVendorPage(orgSlug: string) {
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/v/${orgSlug}`,
        secret: process.env.REVALIDATION_SECRET,
      }),
    });
    if (!res.ok) {
      console.warn(`[revalidate] Non-OK response for /v/${orgSlug}: ${res.status}`);
    }
  } catch (err) {
    console.error("[revalidate] Failed to revalidate vendor page:", err);
  }
}
