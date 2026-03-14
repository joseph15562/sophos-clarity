/**
 * Cyber insurance readiness assessment based on firewall configuration analysis.
 * Maps common insurance questionnaire questions to deterministic analysis results.
 */

import type { AnalysisResult } from "./analyse-config";

/** Common insurance questionnaire questions. */
export const INSURANCE_QUESTIONS = [
  "Is MFA enabled for all admin and VPN access?",
  "Is the firewall monitored 24/7?",
  "Is SSL/TLS inspection (DPI) active?",
  "Is intrusion prevention enabled?",
  "Is admin console access restricted from public internet?",
  "Are firewall rules logged?",
  "Is anti-malware scanning enabled?",
  "Are there any overly broad firewall rules?",
] as const;

export type InsuranceAnswer = "yes" | "no" | "partial";

export interface InsuranceQuestionResult {
  question: string;
  answer: InsuranceAnswer;
  evidence: string;
}

export interface InsuranceReadinessResult {
  questions: InsuranceQuestionResult[];
  readinessScore: number;
}

/** Map question index to assessment logic. */
function assessQuestion(
  idx: number,
  results: AnalysisResult[]
): { answer: InsuranceAnswer; evidence: string } {
  const allFindings = results.flatMap((r) => r.findings);
  const allPostures = results.map((r) => r.inspectionPosture);

  switch (idx) {
    case 0: {
      // MFA enabled for admin and VPN
      const mfaDisabled = allFindings.filter(
        (f) =>
          /mfa|otp|2fa|multi.?factor|one.?time.?password/i.test(f.title) &&
          /disabled|not enabled/i.test(f.title)
      );
      if (mfaDisabled.length === 0) {
        const hasOtpSection = results.some((r) =>
          r.findings.some((f) => /authentication|otp/i.test(f.section))
        );
        return {
          answer: hasOtpSection ? "yes" : "partial",
          evidence:
            hasOtpSection
              ? "No MFA/OTP disabled findings; authentication section present."
              : "No MFA/OTP findings in config — cannot confirm from firewall export alone.",
        };
      }
      return {
        answer: "no",
        evidence: mfaDisabled.map((f) => f.title).join("; "),
      };
    }

    case 1: {
      // Firewall monitored 24/7
      return {
        answer: "partial",
        evidence:
          "24/7 monitoring (SOC/SIEM) cannot be determined from firewall configuration export alone. Verify with operational documentation.",
      };
    }

    case 2: {
      // SSL/TLS inspection (DPI) active
      const anyDpi = allPostures.some((p) => p.dpiEngineEnabled);
      const allDpi = results.length > 0 && allPostures.every((p) => p.dpiEngineEnabled);
      const dpiFindings = allFindings.filter(
        (f) =>
          /ssl|tls|dpi|inspection/i.test(f.title) &&
          /inactive|no.*rule|none.*decrypt/i.test(f.title.toLowerCase())
      );
      if (dpiFindings.length > 0 || !anyDpi) {
        return {
          answer: "no",
          evidence:
            dpiFindings.length > 0
              ? dpiFindings[0].title
              : "No SSL/TLS Decrypt rules found; DPI engine inactive.",
        };
      }
      return {
        answer: allDpi ? "yes" : "partial",
        evidence: allDpi
          ? "SSL/TLS inspection (DPI) active on all firewalls."
          : `DPI active on ${allPostures.filter((p) => p.dpiEngineEnabled).length}/${results.length} firewall(s).`,
      };
    }

    case 3: {
      // Intrusion prevention enabled
      const withIps = allPostures.filter((p) => p.enabledWanRules > 0 && p.withIps > 0);
      const totalWan = allPostures.reduce((s, p) => s + p.enabledWanRules, 0);
      const ipsFindings = allFindings.filter(
        (f) =>
          /ips|intrusion prevention/i.test(f.title) &&
          (f.severity === "high" || f.severity === "critical")
      );
      if (ipsFindings.length > 0) {
        return {
          answer: "no",
          evidence: ipsFindings[0].title,
        };
      }
      if (totalWan === 0) {
        return {
          answer: "partial",
          evidence: "No enabled WAN rules — IPS applicability unclear.",
        };
      }
      const totalIps = allPostures.reduce((s, p) => s + p.withIps, 0);
      const pct = totalWan > 0 ? (totalIps / totalWan) * 100 : 0;
      if (pct >= 90) {
        return { answer: "yes", evidence: `IPS enabled on ${Math.round(pct)}% of WAN rules.` };
      }
      if (pct >= 50) {
        return {
          answer: "partial",
          evidence: `IPS enabled on ${Math.round(pct)}% of WAN rules — some rules without IPS.`,
        };
      }
      return {
        answer: "no",
        evidence: `IPS enabled on only ${Math.round(pct)}% of WAN rules.`,
      };
    }

    case 4: {
      // Admin console restricted from public internet
      const adminExposed = allFindings.filter(
        (f) =>
          /admin.*wan|admin console.*internet|https.*wan|ssh.*wan|management.*wan/i.test(
            f.title
          ) || /admin.*accessible.*wan|wan.*admin/i.test(f.title)
      );
      if (adminExposed.length > 0) {
        return {
          answer: "no",
          evidence: adminExposed.map((f) => f.title).join("; "),
        };
      }
      return {
        answer: "yes",
        evidence: "No admin/HTTPS/SSH exposure to WAN found in Local Service ACL.",
      };
    }

    case 5: {
      // Firewall rules logged
      const loggingOff = allFindings.filter(
        (f) =>
          /logging.*disabled|log.*disabled|rule.*log/i.test(f.title) ||
          (/log/i.test(f.title) && /disabled|off/i.test(f.title.toLowerCase()))
      );
      if (loggingOff.length > 0) {
        return {
          answer: "no",
          evidence: loggingOff[0].title,
        };
      }
      return {
        answer: "yes",
        evidence: "No findings for rules with logging disabled.",
      };
    }

    case 6: {
      // Anti-malware scanning enabled
      const avDisabled = allFindings.filter(
        (f) =>
          /virus|malware|anti.?malware|anti.?virus|scanning/i.test(f.title) &&
          /disabled|not enabled|not active/i.test(f.title.toLowerCase())
      );
      if (avDisabled.length > 0) {
        return {
          answer: "no",
          evidence: avDisabled[0].title,
        };
      }
      const hasVsSection = allFindings.some((f) =>
        /virus|malware|virus scanning/i.test(f.section)
      );
      return {
        answer: hasVsSection ? "yes" : "partial",
        evidence: hasVsSection
          ? "No virus/malware scanning disabled findings."
          : "Virus scanning section not found in config — cannot confirm.",
      };
    }

    case 7: {
      // Overly broad firewall rules
      const broadRules = allFindings.filter(
        (f) =>
          /broad|any.*any|source.*destination.*any/i.test(f.title) &&
          /rule|source|destination/i.test(f.title.toLowerCase())
      );
      if (broadRules.length > 0) {
        return {
          answer: "no",
          evidence: broadRules[0].title,
        };
      }
      return {
        answer: "yes",
        evidence: "No overly broad (Any/Any) firewall rules found.",
      };
    }

    default:
      return { answer: "partial", evidence: "Question not mapped to analysis." };
  }
}

/**
 * Assess cyber insurance readiness from firewall analysis results.
 * Aggregates across all firewalls and returns question answers with evidence.
 * readinessScore = percentage of questions answerable with "yes".
 */
export function assessInsuranceReadiness(
  analysisResults: Record<string, AnalysisResult>
): InsuranceReadinessResult {
  const results = Object.values(analysisResults);
  if (results.length === 0) {
    return {
      questions: INSURANCE_QUESTIONS.map((q) => ({
        question: q,
        answer: "partial" as InsuranceAnswer,
        evidence: "No analysis results — upload firewall config(s) to assess.",
      })),
      readinessScore: 0,
    };
  }

  const questions: InsuranceQuestionResult[] = INSURANCE_QUESTIONS.map((q, idx) => {
    const { answer, evidence } = assessQuestion(idx, results);
    return { question: q, answer, evidence };
  });

  const yesCount = questions.filter((q) => q.answer === "yes").length;
  const readinessScore =
    questions.length > 0 ? Math.round((yesCount / questions.length) * 100) : 0;

  return { questions, readinessScore };
}
