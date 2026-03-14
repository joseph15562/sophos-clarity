/**
 * Re-exports all security dashboard components from the split module.
 * Existing imports from @/components/SecurityDashboards continue to work.
 */
export {
  SeverityBreakdown,
  SecurityFeatureCoverage,
  ZoneTrafficFlow,
  TopFindings,
  RuleHealthOverview,
  FindingsBySection,
  CategoryScoreBars,
} from "./security-dashboards";
