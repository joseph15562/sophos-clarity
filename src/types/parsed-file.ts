import type { ExtractedSections } from "@/lib/extract-sections";
import type { CentralEnrichment } from "@/lib/stream-ai";

export type { CentralEnrichment } from "@/lib/stream-ai";

export type ParsedFile = {
  id: string;
  label: string;
  fileName: string;
  content: string;
  extractedData: ExtractedSections;
  centralEnrichment?: CentralEnrichment;
  serialNumber?: string;
  agentHostname?: string;
  hardwareModel?: string;
};
