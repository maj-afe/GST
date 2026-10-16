/**
 * Tauri API hook for invoking backend commands.
 * Mirrors the Tauri commands defined in src-tauri/src/lib.rs.
 */

export async function invoke<T = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(command, args);
  } catch {
    // Fallback when running outside Tauri (plain Vite dev server)
    console.warn(`Tauri invoke "${command}" not available, returning mock data`);
    return undefined as unknown as T;
  }
}

/** Hook for fetching items from the database */
export async function fetchItems(): Promise<import("@/types").Item[]> {
  return invoke<import("@/types").Item[]>("get_items");
}

/** Hook for fetching customers from the database */
export async function fetchCustomers(
  query: string,
): Promise<import("@/types").Customer[]> {
  return invoke<import("@/types").Customer[]>("search_customers", { query });
}

/** Hook for fetching batches for a given item */
export async function fetchBatches(
  itemId: string,
): Promise<import("@/types").Batch[]> {
  return invoke<import("@/types").Batch[]>("get_batches", { itemId });
}
