import { useEffect, useState } from "react";

/** Opens Central API help dialog when the URL hash is `#central-api-help`. */
export function useCentralApiHelpHash(): [boolean, (open: boolean) => void] {
  const [centralApiHelpOpen, setCentralApiHelpOpen] = useState(false);

  useEffect(() => {
    const syncHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#central-api-help") {
        setCentralApiHelpOpen(true);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return [centralApiHelpOpen, setCentralApiHelpOpen];
}
