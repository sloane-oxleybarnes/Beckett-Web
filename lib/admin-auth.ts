import { cookies } from "next/headers";
import { verifyAdminSession } from "@/lib/admin-session";

export async function isAdminAuthenticated() {
  const token = (await cookies()).get("admin_auth")?.value;
  return verifyAdminSession(token);
}
