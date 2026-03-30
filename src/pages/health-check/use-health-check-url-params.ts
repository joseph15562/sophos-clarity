import { useEffect } from "react";
import type { URLSearchParamsInit } from "react-router-dom";

type SetSearchParams = (
  nextInit: URLSearchParamsInit | ((prev: URLSearchParams) => URLSearchParamsInit),
  navigateOpts?: { replace?: boolean },
) => void;

/**
 * Consumes one-shot SE health check deep-link query params (`customer`, `configUpload`, `upload`)
 * and applies them to local state, then strips them from the URL.
 */
export function useHealthCheckUrlParams(
  searchParams: URLSearchParams,
  setSearchParams: SetSearchParams,
  deps: {
    setCustomerName: (v: string) => void;
    setPreparedFor: (fn: (p: string) => string) => void;
    setConfigUploadCustomerName: (v: string) => void;
    setConfigUploadDialogOpen: (open: boolean) => void;
  },
): void {
  const {
    setCustomerName,
    setPreparedFor,
    setConfigUploadCustomerName,
    setConfigUploadDialogOpen,
  } = deps;

  useEffect(() => {
    const shouldConsume =
      searchParams.has("customer") ||
      searchParams.has("configUpload") ||
      searchParams.has("upload");
    if (!shouldConsume) return;

    const customer = searchParams.get("customer")?.trim();
    const openUpload =
      searchParams.get("configUpload") === "1" || searchParams.get("upload") === "1";

    if (customer) {
      setCustomerName(customer);
      setPreparedFor((p) => p.trim() || customer);
      setConfigUploadCustomerName(customer);
    }
    if (openUpload) {
      setConfigUploadDialogOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("customer");
    next.delete("configUpload");
    next.delete("upload");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    setCustomerName,
    setPreparedFor,
    setConfigUploadCustomerName,
    setConfigUploadDialogOpen,
  ]);
}
