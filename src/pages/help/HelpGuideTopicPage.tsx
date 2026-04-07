import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Lightbulb } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { DocIllustration } from "@/components/help/DocIllustration";
import { Button } from "@/components/ui/button";
import { HELP_GUIDE_CONTENT } from "@/data/help-guide-content";
import { type HelpGuideSlug, isHelpGuideSlug } from "@/data/help-doc-nav";
import { GuideUploadStep } from "@/components/setup-wizard/steps/GuideUploadStep";
import { GuidePreAiStep } from "@/components/setup-wizard/steps/GuidePreAiStep";
import { GuideAiReportsStep } from "@/components/setup-wizard/steps/GuideAiReportsStep";
import { GuideOptimisationStep } from "@/components/setup-wizard/steps/GuideOptimisationStep";
import { GuideRemediationStep } from "@/components/setup-wizard/steps/GuideRemediationStep";
import { GuideToolsStep } from "@/components/setup-wizard/steps/GuideToolsStep";
import { GuideManagementStep } from "@/components/setup-wizard/steps/GuideManagementStep";
import { GuideTeamSecurityStep } from "@/components/setup-wizard/steps/GuideTeamSecurityStep";
import { GuidePortalAlertsStep } from "@/components/setup-wizard/steps/GuidePortalAlertsStep";
import { ConnectorAgentStep } from "@/components/setup-wizard/steps/ConnectorAgentStep";

function GuidePanel({
  slug,
  activeOverlay,
  setActiveOverlay,
  orgName,
}: {
  slug: HelpGuideSlug;
  activeOverlay: string | null;
  setActiveOverlay: (v: string | null) => void;
  orgName?: string;
}) {
  switch (slug) {
    case "upload-assess":
      return <GuideUploadStep />;
    case "connector-agent":
      return <ConnectorAgentStep />;
    case "pre-ai":
      return <GuidePreAiStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />;
    case "ai-reports":
      return (
        <GuideAiReportsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      );
    case "optimisation":
      return (
        <GuideOptimisationStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      );
    case "remediation":
      return (
        <GuideRemediationStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      );
    case "tools-compare":
      return <GuideToolsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />;
    case "management":
      return (
        <GuideManagementStep
          activeOverlay={activeOverlay}
          setActiveOverlay={setActiveOverlay}
          orgName={orgName}
        />
      );
    case "team-security":
      return (
        <GuideTeamSecurityStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      );
    case "portal-alerts":
      return (
        <GuidePortalAlertsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      );
    default:
      return null;
  }
}

export default function HelpGuideTopicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { org } = useAuth();
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  if (!slug || !isHelpGuideSlug(slug)) {
    return <Navigate to="/help" replace />;
  }

  const content = HELP_GUIDE_CONTENT[slug];
  const illustId = content.illustration;

  return (
    <div className="space-y-10 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">{content.title}</span>
      </nav>

      <header className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          {content.title}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          {content.tagline}
        </p>
        <DocIllustration
          id={illustId}
          caption={`Illustrated overview — ${content.title.toLowerCase()} in the FireComply workspace.`}
        />
        <Button size="sm" asChild>
          <Link to={content.primaryAction.to}>{content.primaryAction.label}</Link>
        </Button>
      </header>

      {content.sections.map((section) => (
        <section key={section.heading} className="space-y-3 scroll-mt-28">
          <h2 className="text-lg font-display font-bold text-foreground">{section.heading}</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {section.paragraphs.map((p, i) => (
              <p key={`${section.heading}-${i}`}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      <section
        className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] p-5 space-y-3"
        aria-labelledby="doc-tips-heading"
      >
        <div
          className="flex items-center gap-2 text-foreground font-semibold text-sm"
          id="doc-tips-heading"
        >
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          Practical tips
        </div>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
          {content.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 scroll-mt-28">
        <h2 className="text-lg font-display font-bold text-foreground">Interactive reference</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Use the tiles and overlays below — same behaviour as the product reference previews in
          setup, entirely on this page.
        </p>
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <GuidePanel
            slug={slug}
            activeOverlay={activeOverlay}
            setActiveOverlay={setActiveOverlay}
            orgName={org?.name}
          />
        </div>
      </section>
    </div>
  );
}
