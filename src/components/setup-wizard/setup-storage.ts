const SETUP_KEY = "sophos-firecomply-setup-complete";

export function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === "true";
  } catch (err) {
    console.warn("[isSetupComplete]", err);
    return false;
  }
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_KEY, "true");
  } catch (err) {
    console.warn("[markSetupComplete]", err);
  }
}

export function resetSetupFlag(): void {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch (err) {
    console.warn("[resetSetupFlag]", err);
  }
}
