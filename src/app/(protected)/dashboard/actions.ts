"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export async function dismissOnboarding(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  await db
    .update(users)
    .set({ onboardingDismissedAt: new Date() })
    .where(eq(users.id, session.userId));

  revalidatePath("/dashboard");
}
