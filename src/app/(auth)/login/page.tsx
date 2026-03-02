import { LoginForm } from "./login-form";

export default function LoginPage() {
  const captchaEnabled = process.env.CAPTCHA_ENABLED === "true";
  const siteKey = process.env.CAPTCHACAT_SITE_KEY ?? "";
  const registrationEnabled = process.env.REGISTRATION_MODE !== "disabled";
  return <LoginForm captchaSiteKey={siteKey} captchaEnabled={captchaEnabled} registrationEnabled={registrationEnabled} />;
}
