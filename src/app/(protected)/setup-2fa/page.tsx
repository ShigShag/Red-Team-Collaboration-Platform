import { cookies } from "next/headers";
import { Setup2faForm } from "./setup-2fa-form";

export default async function Setup2faPage() {
  const cookieStore = await cookies();
  const required = cookieStore.get("force_2fa_setup")?.value === "1";

  return <Setup2faForm required={required} />;
}
