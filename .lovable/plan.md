
# Fix: Extract Config Data from HTML Properly

## Problem

The edge function currently sends the **entire raw HTML** (94,000+ lines, including a 4MB base64 font) to a server-side DOM parser (`deno_dom`), which either fails to parse or times out. The section ID mapping is also partially wrong, so even if parsing succeeded, many sections would come back empty. The AI then generates documentation "from thin air" because it receives no actual data.

## Solution: Client-Side Extraction

Move the HTML parsing to the **browser**, where the native DOM parser handles even massive files with no issues. The browser extracts all section data into a compact JSON object, then only that structured data is sent to the edge function for AI processing.

## Changes

### 1. New client-side extraction utility (`src/lib/extract-sections.ts`)

- Create a function that uses `DOMParser` in the browser to parse the uploaded HTML
- Find all sidebar section labels (elements with `data-section-key` and `data-section-name`)
- For each section key, locate the matching `section-content-{kebab-case-key}` div
- Extract table data as arrays of objects (header row becomes keys, body rows become values)
- For non-table sections, extract plain text content
- Return a `Record<string, any>` mapping section names to their extracted data

### 2. Update `src/lib/stream-ai.ts`

- Instead of sending raw `htmlContent`, send the pre-extracted `sections` JSON object
- This drastically reduces the payload size (from ~50MB to maybe 200KB of actual data)

### 3. Update `src/pages/Index.tsx`

- After file upload, call the client-side extraction function
- Pass extracted sections data to the stream function instead of raw HTML

### 4. Rewrite edge function (`supabase/functions/parse-config/index.ts`)

- Remove all the `deno_dom` HTML parsing code (it was not working)
- Accept `sections` (pre-extracted JSON) instead of `htmlContent`
- Pass the sections data directly to the AI with a revised system prompt
- The system prompt will instruct the AI to write plain-English documentation for each section (not JSON), formatted as Markdown
- Fix the TypeScript build error (`'tr' is of type 'unknown'`) by removing the unused DOM code
- Change from "strict data transformer" to "documentation writer" -- the AI should produce human-readable Markdown describing each firewall section in plain English, suitable for an IT admin to replicate the configuration

### 5. Update system prompt

The current prompt asks for JSON output. Change it to produce **Markdown documentation** with clear section headings, explaining each configuration in plain English so another IT admin could replicate it on a fresh Sophos firewall.

## Technical Details

The HTML structure uses:
- Sidebar labels with `data-section-key` (camelCase like `firewallRules`) and `data-section-name` (display name like "Firewall Rules")
- Content divs with IDs like `section-content-firewall-rules` (kebab-case derived from the wrapper div ID)
- Tables with `sophos-table` class, using `sophos-table-header` for headers and `sophos-table-cell` for data
- Some sections have expandable detail rows (e.g., firewall rule details)

The client-side extractor will handle all of these patterns automatically by iterating the sidebar to discover all available sections, rather than hardcoding a fixed list.
