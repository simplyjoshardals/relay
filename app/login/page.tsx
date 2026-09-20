import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { currentOrgName } from "@/lib/mock-data";
import { getSession } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

export default async function LoginPage() {
  // Already signed in (a still-valid access token, or one proxy.ts just
  // just refreshed) — skip the form.
  if (await getSession()) {
    redirect(PATHS.DASHBOARD);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-medium text-ink">{currentOrgName}</h1>
          <p className="mt-1 text-sm text-ink-dim">Sign in to continue.</p>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
