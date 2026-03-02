import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "RedTeam";

export function generateTotpSecret(email: string) {
  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new Secret(),
  });

  return {
    secret: totp.secret.base32,
    otpauthUri: totp.toString(),
  };
}

export async function generateQrCode(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 2,
    color: {
      dark: "#e6eaf0",
      light: "#0d1117",
    },
  });
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
