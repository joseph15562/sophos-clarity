import DOMPurify from "dompurify";
import type { Config } from "dompurify";

interface SafeHtmlProps {
  html: string;
  className?: string;
  config?: Config;
}

/** Renders HTML after DOMPurify sanitization (user- or model-generated markup). */
export function SafeHtml({ html, className, config }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html, config);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
