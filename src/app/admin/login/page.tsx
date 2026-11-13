import Image from "next/image";
import { LoginForms } from "@/components/admin/LoginForms";
import { isMock } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login-card">
        <Image src="/brand/carlos-logo-web.png" alt="Carlo's Barbershop" width={96} height={93} priority />
        <h1>Shop admin</h1>
        <LoginForms mock={isMock()} />
      </div>
    </main>
  );
}
