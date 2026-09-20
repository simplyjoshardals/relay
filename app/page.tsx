import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { PATHS } from "@/utils/paths";

export default async function RootPage() {
  redirect((await getSession()) ? PATHS.DASHBOARD : PATHS.LOGIN);
}
