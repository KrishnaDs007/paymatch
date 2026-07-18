import { redirect } from "next/navigation";
import { AuthScreen } from "@/app/AuthScreen";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthScreen mode="login" />;
}
