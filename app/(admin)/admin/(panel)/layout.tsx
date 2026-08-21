import { redirect } from "next/navigation";
import { validateSession } from "@/lib/admin-auth";
import AdminShell from "@/components/admin-shell";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Real HMAC validation — expired/tampered cookies are rejected here,
  // not just checked for existence
  const authed = await validateSession();
  if (!authed) redirect("/admin/login");

  return <AdminShell>{children}</AdminShell>;
}
