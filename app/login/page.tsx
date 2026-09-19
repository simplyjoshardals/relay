import { redirect } from "next/navigation";
import { Avatar } from "@/components/dashboard/Avatar";
import { currentOrgName, users } from "@/lib/mock-data";
import { hasDevSession } from "@/lib/dev-self";
import { signInAsAction } from "@/lib/dev-auth-actions";
import { PATHS } from "@/utils/paths";

// TODO(milestone 1): real login — email + password against a hashed
// credential, JWT issuance, refresh token rotation (README §5/§16). This
// is a real page wired to fake auth, same pattern used everywhere else in
// this repo ahead of the backend landing: pick who you are, get a cookie,
// done. signInAsAction (lib/dev-auth-actions.ts) is the one place that'll
// need to become a real credential check.
export default async function LoginPage() {
  // Already "signed in" (cookie set from a previous visit, or the dev
  // role-switcher) — skip the picker.
  if (await hasDevSession()) {
    redirect(PATHS.DASHBOARD);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-medium text-ink">{currentOrgName}</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Pick who you are to continue.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-2">
          {users.map((user) => (
            <form key={user.id} action={signInAsAction}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-panel-raised"
              >
                <Avatar
                  initials={user.initials}
                  seed={user.id}
                  title={user.name}
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{user.name}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {user.email}
                  </div>
                </div>

                <span className="shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[11px] text-ink-faint">
                  {user.role === "MANAGER" ? "Manager" : "Member"}
                </span>
              </button>
            </form>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          No password yet — this is dev scaffolding standing in for real sign-in
          (README Milestone 1).
        </p>
      </div>
    </div>
  );
}
