/** Server-controlled IDs only; tenant roles and user metadata are not authority. */
export function hasMatrizAccess(userId: string, configuredIds: string | undefined) {
  const ids = (configuredIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return !!userId && ids.includes(userId);
}
