import demoConfigHtml from "@/data/demo-config.html?raw";

export const DEMO_FILE_NAME = "demo-xgs-config.html";
export const DEMO_LABEL = "Demo XGS Firewall";

export function getDemoConfigHtml(): string {
  return demoConfigHtml;
}

export function isDemoFile(fileName: string): boolean {
  return fileName === DEMO_FILE_NAME;
}
