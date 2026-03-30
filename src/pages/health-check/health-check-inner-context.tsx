import { createContext, useContext, type ReactNode } from "react";

export type HealthCheckInnerModel = ReturnType<
  typeof import("./use-health-check-inner-state").useHealthCheckInnerState
>;

const HealthCheckInnerContext = createContext<HealthCheckInnerModel | null>(null);

export function HealthCheckInnerProvider({
  value,
  children,
}: {
  value: HealthCheckInnerModel;
  children: ReactNode;
}) {
  return (
    <HealthCheckInnerContext.Provider value={value}>{children}</HealthCheckInnerContext.Provider>
  );
}

export function useHealthCheckInnerModel(): HealthCheckInnerModel {
  const ctx = useContext(HealthCheckInnerContext);
  if (!ctx) {
    throw new Error("useHealthCheckInnerModel must be used within HealthCheckInnerProvider");
  }
  return ctx;
}
