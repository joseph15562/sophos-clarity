/** Parallel fan-out chunk size for per-tenant Central API calls (alerts, MDR, groups, etc.). */
export const CENTRAL_TENANT_BATCH = 4;

export async function mapTenantBatches<T>(
  tenantIds: string[],
  fn: (tenantId: string) => Promise<T[]>,
  options?: { batchSize?: number },
): Promise<T[]> {
  const batchSize = options?.batchSize ?? CENTRAL_TENANT_BATCH;
  const out: T[] = [];
  for (let i = 0; i < tenantIds.length; i += batchSize) {
    const chunk = tenantIds.slice(i, i + batchSize);
    const batch = await Promise.all(chunk.map((tenantId) => fn(tenantId)));
    for (const rows of batch) out.push(...rows);
  }
  return out;
}
