export const USER_COLORS = [
  "#e8735a", // coral (accent)
  "#5ab8e8", // sky blue
  "#8ae85a", // lime green
  "#e85adf", // magenta
  "#e8c95a", // gold
  "#5ae8c5", // teal
  "#b05ae8", // purple
  "#e85a7d", // rose
] as const;

export function getUserColor(
  userId: string,
  orderedMemberIds: string[]
): string {
  const index = orderedMemberIds.indexOf(userId);
  return USER_COLORS[index >= 0 ? index % USER_COLORS.length : 0];
}
