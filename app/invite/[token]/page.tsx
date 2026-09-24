import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/invite/AcceptInviteForm";
import { previewInvitation } from "@/server/application/invitations";
import { PATHS } from "@/utils/paths";

// The link's token is a bearer credential: keep it out of search indexes
// and out of `Referer` headers on anything the page might link to.
export const metadata: Metadata = {
  title: "Join the team — Relay",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The public landing page for an invitation link (Milestone 10). Sits
 * outside the (dashboard) route group on purpose — the visitor has no
 * session yet, so that layout's sign-in gate would just bounce them to
 * /login. Deliberately does *not* redirect an already-signed-in visitor
 * away the way /login does: someone accepting a link in a browser that
 * happens to be signed in as somebody else should still be able to.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await previewInvitation(token);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {invitation.valid ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-lg font-medium text-ink">
                Join {invitation.orgName}
              </h1>
              <p className="mt-1 text-sm text-ink-dim">
                You&apos;ve been invited as a{" "}
                {invitation.role === "MANAGER" ? "Manager" : "Member"} (
                {invitation.email}).
              </p>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4">
              <AcceptInviteForm token={token} defaultName={invitation.name} />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-line bg-panel p-4 text-center">
            <h1 className="text-lg font-medium text-ink">
              This link isn&apos;t valid
            </h1>
            <p className="mt-2 text-sm text-ink-dim">
              It may have expired, already been used, or been withdrawn. Ask a
              Manager to send you a new invitation.
            </p>
            <Link
              href={PATHS.LOGIN}
              className="mt-4 inline-block text-sm text-ink underline hover:text-ink-dim"
            >
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
