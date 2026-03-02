import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { getSetting } from "@/lib/platform-settings";

export default async function RegisterPage() {
  const registrationMode = (await getSetting("registration_mode")) as
    | "open"
    | "code"
    | "invite"
    | "disabled";
  if (registrationMode === "disabled") redirect("/login");

  const captchaEnabled = process.env.CAPTCHA_ENABLED === "true";
  const siteKey = process.env.CAPTCHACAT_SITE_KEY ?? "";
  return (
    <RegisterForm
      captchaSiteKey={siteKey}
      captchaEnabled={captchaEnabled}
      registrationMode={registrationMode}
    />
  );
}
