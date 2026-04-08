/**
 * Repair corrupted markdown image syntax for data-URI PNG/JPEG/GIF logos (Assess cover, saved reports).
 * Centralised here so HTML preview, pdfmake PDF, and Word export stay aligned.
 */

function compactDataUriBody(s: string): string {
  return s.replace(/\s+/g, "");
}

const DATA_URI_IN_PARENS = /^data:image\/(png|jpeg|jpg|gif);base64,/i;

/**
 * Find closing `)` or fullwidth `）` for a markdown `( … )` span; base64 must not contain `)`.
 */
function indexOfClosingParen(md: string, from: number): number {
  for (let i = from; i < md.length; i++) {
    const c = md[i];
    if (c === ")" || c === "\uFF09") return i;
  }
  return -1;
}

/**
 * `Label|(data:image/...;base64,...)` — lost `](` before `(`.
 */
function normalizePipeLabelDataUris(md: string): string {
  return md.replace(
    /(^|[\r\n])([\t \u00A0\uFEFF]*)([^\r\n]+?)\|\(\s*data:image\s*\/\s*(png|jpeg|jpg|gif)\s*;\s*base64\s*,([\s\S]*?)\)/gi,
    (_, lb: string, ind: string, label: string, ext: string, body: string) =>
      `${lb}${ind}![${String(label).trim()}](data:image/${String(ext).toLowerCase()};base64,${compactDataUriBody(body)})`,
  );
}

/**
 * Scan for `](data:image/...;base64,...)` and fix:
 * - `Company Logo](data:...` → `![Company Logo](data:...)`
 * - `[Company Logo](data:...` → `![Company Logo](data:...)`
 * Skips when the line already has proper `![...](` before this `]`.
 */
function normalizeBracketOpensDataUris(md: string): string {
  const re = /\]\(\s*data:image\s*\/\s*(png|jpeg|jpg|gif)\s*;\s*base64\s*,/gi;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const closeBracketIdx = m.index;
    const lineStart =
      Math.max(
        md.lastIndexOf("\n", closeBracketIdx - 1),
        md.lastIndexOf("\r", closeBracketIdx - 1),
      ) + 1;
    const linePrefix = md.slice(lineStart, closeBracketIdx);
    const indentM = linePrefix.match(/^[\s\uFEFF\u00A0]*/);
    const indent = indentM ? indentM[0] : "";
    const rest = linePrefix.slice(indent.length);
    const trimmed = rest.trimStart();

    if (trimmed.startsWith("![")) {
      re.lastIndex = closeBracketIdx + 1;
      continue;
    }

    const parenOpen = closeBracketIdx + 1;
    if (md[parenOpen] !== "(") {
      re.lastIndex = closeBracketIdx + 1;
      continue;
    }
    const parenClose = indexOfClosingParen(md, parenOpen + 1);
    if (parenClose < 0) {
      re.lastIndex = closeBracketIdx + 1;
      continue;
    }
    const uriRaw = md.slice(parenOpen + 1, parenClose);
    const compactUri = compactDataUriBody(uriRaw);
    if (!DATA_URI_IN_PARENS.test(compactUri)) {
      re.lastIndex = closeBracketIdx + 1;
      continue;
    }

    let newBlock: string;
    if (trimmed.startsWith("[")) {
      newBlock = `${indent}!${rest}](${compactUri})`;
    } else {
      newBlock = `${indent}![${rest}](${compactUri})`;
    }

    out += md.slice(last, lineStart);
    out += newBlock;
    last = parenClose + 1;
    re.lastIndex = last;
  }
  out += md.slice(last);
  return out;
}

/**
 * Public entry: all known broken data-URI image patterns → valid `![alt](data:image/...;base64,...)`.
 */
export function normalizeMarkdownEmbeddedDataImages(markdown: string): string {
  let md = normalizePipeLabelDataUris(markdown);
  md = normalizeBracketOpensDataUris(md);
  return md;
}

/** @deprecated Use {@link normalizeMarkdownEmbeddedDataImages} — kept for existing imports. */
export const normalizePdfImageMarkdownSyntax = normalizeMarkdownEmbeddedDataImages;
