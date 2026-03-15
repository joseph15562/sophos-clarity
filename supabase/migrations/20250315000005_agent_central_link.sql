ALTER TABLE agents ADD COLUMN IF NOT EXISTS central_firewall_id text DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_central_firewall ON public.agents(central_firewall_id);
