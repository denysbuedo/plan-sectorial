import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserManagement from "@/components/UserManagement";

export default async function AdminUsersPage() {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    redirect("/");
  }

  return <UserManagement />;
}
