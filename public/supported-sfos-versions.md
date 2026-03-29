# Supported Sophos Firewall exports (parser matrix)

FireComply’s deterministic parser targets **Sophos XG / XGS (SFOS)** configuration exports.

## Supported inputs

| Format         | Source                                      | Notes                                          |
| -------------- | ------------------------------------------- | ---------------------------------------------- |
| **HTML / HTM** | SFOS web admin backup / report-style export | Primary path for most assessments.             |
| **XML**        | Entities-style consolidated XML export      | Used when available from your export workflow. |

## Firmware

- **SFOS 18.x–21.x** (and current XGS train) are routinely tested with partner exports.
- Very old v17 or legacy SG **non-SFOS** dumps are **not** in scope for the same parser guarantees.

## Exporter hygiene

- Prefer a **full** configuration export (not a single-module snippet) for accurate rule and posture scoring.
- If the vendor changes export layout in a minor release and parsing regresses, capture a **sanitised sample** and open an issue with the SFOS version string.

## Related

- Connector agent submits **raw config** through the same analysis pipeline (after optional Central-assisted discovery).
- For self-hosted / air-gapped deployment notes, see the `docs/SELF-HOSTED.md` file in the repository.
