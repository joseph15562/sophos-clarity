/**
 * Static peer benchmark data by environment type.
 * Values represent average scores from aggregated assessments.
 * These will improve over time as more assessments are collected.
 */

export interface CategoryScores {
  [category: string]: number;
}

export interface BenchmarkData {
  overall: number;
  categories: Record<string, number>;
  sampleSize: number;
}

// Static fallback benchmarks — will be replaced by live aggregated data when available
const BENCHMARKS: Record<string, BenchmarkData> = {
  "Education": {
    overall: 58,
    categories: {
      "Web Filtering": 72, "Intrusion Prevention": 45,
      "Application Control": 35, "Authentication": 60,
      "Logging": 80, "Rule Hygiene": 55, "Admin Access": 70, "Anti-Malware": 65,
    },
    sampleSize: 142,
  },
  "Healthcare": {
    overall: 64,
    categories: {
      "Web Filtering": 75, "Intrusion Prevention": 60,
      "Application Control": 50, "Authentication": 70,
      "Logging": 85, "Rule Hygiene": 55, "Admin Access": 65, "Anti-Malware": 70,
    },
    sampleSize: 89,
  },
  "Financial": {
    overall: 78,
    categories: {
      "Web Filtering": 90, "Intrusion Prevention": 80,
      "Application Control": 70, "Authentication": 85,
      "Logging": 95, "Rule Hygiene": 70, "Admin Access": 80, "Anti-Malware": 85,
    },
    sampleSize: 67,
  },
  "Government": {
    overall: 72,
    categories: {
      "Web Filtering": 80, "Intrusion Prevention": 70,
      "Application Control": 60, "Authentication": 80,
      "Logging": 90, "Rule Hygiene": 65, "Admin Access": 75, "Anti-Malware": 75,
    },
    sampleSize: 53,
  },
  "Retail": {
    overall: 55,
    categories: {
      "Web Filtering": 65, "Intrusion Prevention": 50,
      "Application Control": 40, "Authentication": 55,
      "Logging": 70, "Rule Hygiene": 50, "Admin Access": 60, "Anti-Malware": 60,
    },
    sampleSize: 98,
  },
  "Manufacturing": {
    overall: 52,
    categories: {
      "Web Filtering": 55, "Intrusion Prevention": 45,
      "Application Control": 35, "Authentication": 50,
      "Logging": 65, "Rule Hygiene": 50, "Admin Access": 55, "Anti-Malware": 55,
    },
    sampleSize: 74,
  },
  "Professional Services": {
    overall: 62,
    categories: {
      "Web Filtering": 70, "Intrusion Prevention": 55,
      "Application Control": 50, "Authentication": 65,
      "Logging": 75, "Rule Hygiene": 55, "Admin Access": 65, "Anti-Malware": 65,
    },
    sampleSize: 121,
  },
  "Technology": {
    overall: 70,
    categories: {
      "Web Filtering": 75, "Intrusion Prevention": 65,
      "Application Control": 60, "Authentication": 75,
      "Logging": 85, "Rule Hygiene": 65, "Admin Access": 70, "Anti-Malware": 75,
    },
    sampleSize: 156,
  },
};

const DEFAULT_BENCHMARK: BenchmarkData = {
  overall: 62,
  categories: {
    "Web Filtering": 70, "Intrusion Prevention": 55,
    "Application Control": 50, "Authentication": 65,
    "Logging": 78, "Rule Hygiene": 55, "Admin Access": 65, "Anti-Malware": 65,
  },
  sampleSize: 800,
};

export function getBenchmark(environment: string): BenchmarkData {
  const normalised = environment.trim();
  for (const [key, data] of Object.entries(BENCHMARKS)) {
    if (normalised.toLowerCase().includes(key.toLowerCase())) return data;
  }
  return DEFAULT_BENCHMARK;
}

/**
 * Attempts to load real benchmark data from Supabase.
 * Returns null when no live data is available yet.
 */
export async function fetchLiveBenchmarks(environment: string): Promise<BenchmarkData | null> {
  // TODO: Load from Supabase benchmarks table when available
  return null;
}

/**
 * Main entry point: tries live benchmarks first, then falls back to static data.
 */
export async function getBenchmarkData(environment: string): Promise<BenchmarkData> {
  const live = await fetchLiveBenchmarks(environment);
  if (live) return live;
  return getBenchmark(environment);
}

/**
 * Submits anonymised scores to the benchmarks table for aggregation.
 * No-op stub — will push to Supabase when the benchmarks table is ready.
 */
export async function submitAnonymousScore(
  _environment: string,
  _scores: CategoryScores,
): Promise<void> {
  // Will push anonymised scores to benchmarks table in the future
}

export function getBenchmarkLabel(environment: string): string {
  const normalised = environment.trim();
  for (const key of Object.keys(BENCHMARKS)) {
    if (normalised.toLowerCase().includes(key.toLowerCase())) return key;
  }
  return "All Sectors";
}

export const BENCHMARK_ENVIRONMENTS = Object.keys(BENCHMARKS);
