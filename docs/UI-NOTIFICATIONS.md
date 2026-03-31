# Toasts vs Notification Centre

FireComply uses two complementary surfaces for user feedback. They are intentionally separate: **no event should appear as both a Sonner toast and a Notification Centre item with the same primary message** in the same user action.

## Sonner toasts (`sonner`)

- **Ephemeral** — auto-dismiss (typically a few seconds unless configured otherwise).
- **Best for** immediate confirmation or failure on the current action: parse errors, save failures, quick tips (“More reports available”), one-off API errors.
- **Stack** — single toast region (see Dimension 4 / Finding 4.1 in `docs/REVIEW.md`).

## Notification Centre (`useNotifications` + `NotificationCentre`)

- **Persistent** until the user dismisses or clears (backed by `localStorage`).
- **Best for** outcomes the user may want to revisit: successful **Reports Saved** / **Assessment Saved**, **Generating Reports** (long-running batch), audit-worthy completions.
- Open from the app header bell; items support read/dismiss.

## When to use which

| Situation                                           | Surface                      |
| --------------------------------------------------- | ---------------------------- |
| User clicked Save — success with report count       | Notification Centre          |
| User triggered Generate All — in-flight notice      | Notification Centre          |
| Validation / transient network error on one control | Toast                        |
| Optional nudge (“generate Executive Brief”)         | Toast (action button OK)     |
| MFA reset, invite sent, destructive confirm result  | Toast (or inline form error) |

## Auditing duplicates

When adding a flow, grep for the same user-visible string in `toast.*` and `addNotification(` under `src/`. If both fire for the same gesture, drop one or reword so roles stay distinct (e.g. toast = error detail, notification = durable success).
