import { redirect } from "next/navigation";
import { hasDevSession } from "@/lib/dev-self";
import { PATHS } from "@/utils/paths";

export default async function RootPage() {
  redirect((await hasDevSession()) ? PATHS.DASHBOARD : PATHS.LOGIN);
}
