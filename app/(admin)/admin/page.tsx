import { redirect } from "next/navigation";
import { validateSession } from "@/lib/admin-auth";

export default async function AdminIndexPage() {
  const authed = await validateSession();
  redirect(authed ? "/admin/dashboard" : "/admin/login");
}
