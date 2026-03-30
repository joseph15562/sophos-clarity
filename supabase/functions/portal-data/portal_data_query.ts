import { z } from "npm:zod@3.24.2";

/** GET query params for portal-data (public portal bootstrap). */
export const portalDataGetQuerySchema = z
  .object({
    slug: z.string().max(200).optional(),
    org_id: z.string().max(200).optional(),
  })
  .strict();

export type PortalDataGetQuery = z.infer<typeof portalDataGetQuerySchema>;
