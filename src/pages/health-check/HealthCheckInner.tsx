import { useHealthCheckInnerState } from "./use-health-check-inner-state";
import { HealthCheckInnerProvider } from "./health-check-inner-context";
import { HealthCheckInnerLayout } from "./HealthCheckInnerLayout";

export function HealthCheckInner() {
  const model = useHealthCheckInnerState();
  return (
    <HealthCheckInnerProvider value={model}>
      <HealthCheckInnerLayout />
    </HealthCheckInnerProvider>
  );
}
