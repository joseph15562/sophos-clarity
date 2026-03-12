import type { AnalysisResult } from "./analyse-config";
import type { RiskScoreResult } from "./risk-score";
import { computeRiskScore } from "./risk-score";

export interface AssessmentSnapshot {
  id: string;
  timestamp: number;
  customerName: string;
  environment: string;
  firewalls: {
    label: string;
    riskScore: RiskScoreResult;
    totalRules: number;
    totalFindings: number;
  }[];
  overallScore: number;
  overallGrade: string;
}

const DB_NAME = "sophos-firecomply";
const STORE_NAME = "assessments";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("customerName", "customerName", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAssessment(
  analysisResults: Record<string, AnalysisResult>,
  customerName: string,
  environment: string,
): Promise<AssessmentSnapshot> {
  const firewalls = Object.entries(analysisResults).map(([label, ar]) => ({
    label,
    riskScore: computeRiskScore(ar),
    totalRules: ar.stats.totalRules,
    totalFindings: ar.findings.length,
  }));

  const scores = firewalls.map((f) => f.riskScore.overall);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallGrade =
    overallScore >= 90 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : overallScore >= 40 ? "D" : "F";

  const snapshot: AssessmentSnapshot = {
    id: `assess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    customerName: customerName || "Unnamed",
    environment: environment || "Unknown",
    firewalls,
    overallScore,
    overallGrade,
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return snapshot;
}

export async function loadHistory(): Promise<AssessmentSnapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).index("timestamp").getAll();
    req.onsuccess = () => resolve((req.result as AssessmentSnapshot[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAssessment(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function detectDrift(
  current: AssessmentSnapshot,
  previous: AssessmentSnapshot,
): { improved: string[]; regressed: string[]; scoreDelta: number } {
  const improved: string[] = [];
  const regressed: string[] = [];

  for (const fw of current.firewalls) {
    const prev = previous.firewalls.find((p) => p.label === fw.label);
    if (!prev) continue;

    for (const cat of fw.riskScore.categories) {
      const prevCat = prev.riskScore.categories.find((c) => c.label === cat.label);
      if (!prevCat) continue;
      const delta = cat.pct - prevCat.pct;
      if (delta >= 10) improved.push(`${fw.label}: ${cat.label} +${delta}%`);
      if (delta <= -10) regressed.push(`${fw.label}: ${cat.label} ${delta}%`);
    }
  }

  return {
    improved,
    regressed,
    scoreDelta: current.overallScore - previous.overallScore,
  };
}
