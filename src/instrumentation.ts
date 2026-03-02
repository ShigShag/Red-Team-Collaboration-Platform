export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log(
      `[startup] Next.js server ready — env=${process.env.NODE_ENV}, port=${process.env.PORT || 3000}`
    );
  }
}
