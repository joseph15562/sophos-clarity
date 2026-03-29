-- G2.1 — Connector agent software version (heartbeat payload) for fleet ops / outdated filters
alter table public.agents add column if not exists connector_version text;

comment on column public.agents.connector_version is 'Reported by connector on heartbeat (e.g. semver); compared to app VITE_CONNECTOR_VERSION_LATEST for outdated UI.';
