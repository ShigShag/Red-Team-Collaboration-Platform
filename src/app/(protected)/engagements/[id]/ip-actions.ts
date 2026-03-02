"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { engagementMembers, ipGeolocations } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export type IpActionState = {
  error?: string;
  success?: string;
};

export async function assignCountry(
  _prev: IpActionState,
  formData: FormData
): Promise<IpActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagementId = formData.get("engagementId") as string;
  const geolocationId = formData.get("geolocationId") as string;
  const countryCode = formData.get("countryCode") as string;
  const countryName = formData.get("countryName") as string;

  if (!engagementId || !geolocationId || !countryCode || !countryName) {
    return { error: "Missing required fields" };
  }

  if (countryCode.length !== 2) {
    return { error: "Invalid country code" };
  }

  // Require write access
  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member || member.role === "read") {
    return { error: "Write access required" };
  }

  // Verify the geolocation belongs to this engagement
  const [geo] = await db
    .select({ id: ipGeolocations.id })
    .from(ipGeolocations)
    .where(
      and(
        eq(ipGeolocations.id, geolocationId),
        eq(ipGeolocations.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!geo) return { error: "IP not found" };

  await db
    .update(ipGeolocations)
    .set({
      countryCode,
      countryName,
      isManual: true,
      updatedAt: new Date(),
    })
    .where(eq(ipGeolocations.id, geolocationId));

  revalidatePath(`/engagements/${engagementId}`);
  revalidatePath(`/engagements/${engagementId}/ips`);
  return { success: "Country assigned" };
}
