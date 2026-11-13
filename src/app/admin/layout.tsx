import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal/admin";
import { buttonVariants } from "@/components/ui/button";
import { SignOutForm } from "@/components/admin/sign-out-form";

// Session-scoped data must never be prerendered or shared in the route cache.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?status=unauthorized");
  }
  return (
    <div className="admin-shell space-y-8">
      <nav aria-label="Administración" className="admin-shell-nav flex flex-wrap items-start gap-3 border-b border-border pb-6">
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>Resumen</Link>
        <Link href="/admin/participants" className={buttonVariants({ variant: "outline" })}>Participantes</Link>
        <SignOutForm />
      </nav>
      {children}
    </div>
  );
}
