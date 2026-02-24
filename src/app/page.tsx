import { getSession } from "@/lib/auth";
import StudentList from "@/components/StudentList";

export default async function Home() {
  const session = await getSession();

  return (
    <StudentList
      userRole={session?.role ?? "etecsa"}
      userEntity={session?.entity ?? null}
      username={session?.username ?? ""}
    />
  );
}
