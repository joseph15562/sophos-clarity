export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      organisations: {
        Row: { id: string; name: string; submission_retention_days: number; mfa_required: boolean; webhook_url: string | null; webhook_secret: string | null; report_template: Json | null; created_at: string }
        Insert: { id?: string; name: string; submission_retention_days?: number; mfa_required?: boolean; webhook_url?: string | null; webhook_secret?: string | null; report_template?: Json | null; created_at?: string }
        Update: { id?: string; name?: string; submission_retention_days?: number; mfa_required?: boolean; webhook_url?: string | null; webhook_secret?: string | null; report_template?: Json | null; created_at?: string }
        Relationships: []
      }
      passkey_credentials: {
        Row: {
          id: string
          user_id: string
          credential_id: string
          public_key: string
          counter: number
          device_type: string
          transports: string[]
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          credential_id: string
          public_key: string
          counter?: number
          device_type?: string
          transports?: string[]
          name?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          credential_id?: string
          public_key?: string
          counter?: number
          device_type?: string
          transports?: string[]
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          id: string
          org_id: string
          name: string
          api_key_hash: string
          api_key_prefix: string
          tenant_id: string | null
          tenant_name: string | null
          firewall_host: string
          firewall_port: number
          customer_name: string
          environment: string
          schedule_cron: string
          firmware_version: string | null
          firmware_version_override: string | null
          serial_number: string | null
          hardware_model: string | null
          last_seen_at: string | null
          last_score: number | null
          last_grade: string | null
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          api_key_hash: string
          api_key_prefix: string
          tenant_id?: string | null
          tenant_name?: string | null
          firewall_host: string
          firewall_port?: number
          customer_name?: string
          environment?: string
          schedule_cron?: string
          firmware_version?: string | null
          firmware_version_override?: string | null
          serial_number?: string | null
          hardware_model?: string | null
          last_seen_at?: string | null
          last_score?: number | null
          last_grade?: string | null
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          api_key_hash?: string
          api_key_prefix?: string
          tenant_id?: string | null
          tenant_name?: string | null
          firewall_host?: string
          firewall_port?: number
          customer_name?: string
          environment?: string
          schedule_cron?: string
          firmware_version?: string | null
          firmware_version_override?: string | null
          serial_number?: string | null
          hardware_model?: string | null
          last_seen_at?: string | null
          last_score?: number | null
          last_grade?: string | null
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "agents_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      agent_submissions: {
        Row: {
          id: string
          agent_id: string
          org_id: string
          customer_name: string
          overall_score: number
          overall_grade: string
          firewalls: Json
          findings_summary: Json
          finding_titles: string[]
          threat_status: Json | null
          drift: Json | null
          full_analysis: Json | null
          raw_config: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          org_id: string
          customer_name?: string
          overall_score?: number
          overall_grade?: string
          firewalls?: Json
          findings_summary?: Json
          finding_titles?: string[]
          threat_status?: Json | null
          drift?: Json | null
          full_analysis?: Json | null
          raw_config?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          org_id?: string
          customer_name?: string
          overall_score?: number
          overall_grade?: string
          firewalls?: Json
          findings_summary?: Json
          finding_titles?: string[]
          threat_status?: Json | null
          drift?: Json | null
          full_analysis?: Json | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "agent_submissions_agent_id_fkey"; columns: ["agent_id"]; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "agent_submissions_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      org_members: {
        Row: { id: string; org_id: string; user_id: string; role: string; joined_at: string }
        Insert: { id?: string; org_id: string; user_id: string; role?: string; joined_at?: string }
        Update: { id?: string; org_id?: string; user_id?: string; role?: string; joined_at?: string }
        Relationships: [
          { foreignKeyName: "org_members_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      assessments: {
        Row: { id: string; org_id: string; created_by: string | null; customer_name: string; environment: string; firewalls: Json; overall_score: number; overall_grade: string; created_at: string }
        Insert: { id?: string; org_id: string; created_by?: string | null; customer_name?: string; environment?: string; firewalls?: Json; overall_score?: number; overall_grade?: string; created_at?: string }
        Update: { id?: string; org_id?: string; created_by?: string | null; customer_name?: string; environment?: string; firewalls?: Json; overall_score?: number; overall_grade?: string; created_at?: string }
        Relationships: [
          { foreignKeyName: "assessments_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      org_invites: {
        Row: { id: string; org_id: string; email: string; invited_by: string | null; created_at: string }
        Insert: { id?: string; org_id: string; email: string; invited_by?: string | null; created_at?: string }
        Update: { id?: string; org_id?: string; email?: string; invited_by?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "org_invites_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      saved_reports: {
        Row: { id: string; org_id: string; created_by: string | null; customer_name: string; environment: string; report_type: string; reports: Json; analysis_summary: Json; created_at: string }
        Insert: { id?: string; org_id: string; created_by?: string | null; customer_name: string; environment?: string; report_type?: string; reports?: Json; analysis_summary?: Json; created_at?: string }
        Update: { id?: string; org_id?: string; created_by?: string | null; customer_name?: string; environment?: string; report_type?: string; reports?: Json; analysis_summary?: Json; created_at?: string }
        Relationships: [
          { foreignKeyName: "saved_reports_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      central_credentials: {
        Row: { org_id: string; encrypted_client_id: string; encrypted_client_secret: string; partner_id: string; partner_type: string; api_hosts: Json; connected_at: string; last_synced_at: string | null }
        Insert: { org_id: string; encrypted_client_id: string; encrypted_client_secret: string; partner_id?: string; partner_type?: string; api_hosts?: Json; connected_at?: string; last_synced_at?: string | null }
        Update: { org_id?: string; encrypted_client_id?: string; encrypted_client_secret?: string; partner_id?: string; partner_type?: string; api_hosts?: Json; connected_at?: string; last_synced_at?: string | null }
        Relationships: [
          { foreignKeyName: "central_credentials_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      central_tenants: {
        Row: { id: string; org_id: string; central_tenant_id: string; name: string; data_region: string; api_host: string; billing_type: string; synced_at: string }
        Insert: { id?: string; org_id: string; central_tenant_id: string; name?: string; data_region?: string; api_host?: string; billing_type?: string; synced_at?: string }
        Update: { id?: string; org_id?: string; central_tenant_id?: string; name?: string; data_region?: string; api_host?: string; billing_type?: string; synced_at?: string }
        Relationships: [
          { foreignKeyName: "central_tenants_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      central_firewalls: {
        Row: { id: string; org_id: string; central_tenant_id: string; firewall_id: string; serial_number: string; hostname: string; name: string; firmware_version: string; model: string; status_json: Json; cluster_json: Json | null; group_json: Json | null; external_ips: Json; geo_location: Json | null; synced_at: string }
        Insert: { id?: string; org_id: string; central_tenant_id: string; firewall_id: string; serial_number?: string; hostname?: string; name?: string; firmware_version?: string; model?: string; status_json?: Json; cluster_json?: Json | null; group_json?: Json | null; external_ips?: Json; geo_location?: Json | null; synced_at?: string }
        Update: { id?: string; org_id?: string; central_tenant_id?: string; firewall_id?: string; serial_number?: string; hostname?: string; name?: string; firmware_version?: string; model?: string; status_json?: Json; cluster_json?: Json | null; group_json?: Json | null; external_ips?: Json; geo_location?: Json | null; synced_at?: string }
        Relationships: [
          { foreignKeyName: "central_firewalls_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      firewall_config_links: {
        Row: { id: string; org_id: string; config_hostname: string; config_hash: string; central_firewall_id: string; central_tenant_id: string; linked_by: string | null; linked_at: string }
        Insert: { id?: string; org_id: string; config_hostname?: string; config_hash?: string; central_firewall_id: string; central_tenant_id: string; linked_by?: string | null; linked_at?: string }
        Update: { id?: string; org_id?: string; config_hostname?: string; config_hash?: string; central_firewall_id?: string; central_tenant_id?: string; linked_by?: string | null; linked_at?: string }
        Relationships: [
          { foreignKeyName: "firewall_config_links_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      audit_log: {
        Row: { id: string; org_id: string; user_id: string | null; action: string; resource_type: string; resource_id: string; metadata: Json; created_at: string }
        Insert: { id?: string; org_id: string; user_id?: string | null; action: string; resource_type?: string; resource_id?: string; metadata?: Json; created_at?: string }
        Update: { id?: string; org_id?: string; user_id?: string | null; action?: string; resource_type?: string; resource_id?: string; metadata?: Json; created_at?: string }
        Relationships: [
          { foreignKeyName: "audit_log_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      finding_snapshots: {
        Row: { id: string; org_id: string; hostname: string; titles: string[]; score: number; created_at: string }
        Insert: { id?: string; org_id: string; hostname: string; titles?: string[]; score?: number; created_at?: string }
        Update: { id?: string; org_id?: string; hostname?: string; titles?: string[]; score?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: "finding_snapshots_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      remediation_status: {
        Row: { id: string; org_id: string; playbook_id: string; customer_hash: string; completed_by: string | null; completed_at: string }
        Insert: { id?: string; org_id: string; playbook_id: string; customer_hash: string; completed_by?: string | null; completed_at?: string }
        Update: { id?: string; org_id?: string; playbook_id?: string; customer_hash?: string; completed_by?: string | null; completed_at?: string }
        Relationships: [
          { foreignKeyName: "remediation_status_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      shared_reports: {
        Row: { id: string; org_id: string; share_token: string; markdown: string; customer_name: string; created_by: string | null; expires_at: string; created_at: string; allow_download: boolean; advisor_notes: string | null }
        Insert: { id?: string; org_id: string; share_token: string; markdown: string; customer_name?: string; created_by?: string | null; expires_at: string; created_at?: string; allow_download?: boolean; advisor_notes?: string | null }
        Update: { id?: string; org_id?: string; share_token?: string; markdown?: string; customer_name?: string; created_by?: string | null; expires_at?: string; created_at?: string; allow_download?: boolean; advisor_notes?: string | null }
        Relationships: [
          { foreignKeyName: "shared_reports_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      alert_rules: {
        Row: { id: string; org_id: string; event_type: string; channel: string; config: Json; enabled: boolean; created_at: string }
        Insert: { id?: string; org_id: string; event_type: string; channel: string; config?: Json; enabled?: boolean; created_at?: string }
        Update: { id?: string; org_id?: string; event_type?: string; channel?: string; config?: Json; enabled?: boolean; created_at?: string }
        Relationships: [
          { foreignKeyName: "alert_rules_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
      portal_config: {
        Row: { id: string; org_id: string; slug: string | null; tenant_name: string | null; logo_url: string | null; company_name: string | null; accent_color: string; welcome_message: string | null; sla_info: string | null; contact_email: string | null; contact_phone: string | null; footer_text: string | null; visible_sections: Json; show_branding: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; org_id: string; slug?: string | null; tenant_name?: string | null; logo_url?: string | null; company_name?: string | null; accent_color?: string; welcome_message?: string | null; sla_info?: string | null; contact_email?: string | null; contact_phone?: string | null; footer_text?: string | null; visible_sections?: Json; show_branding?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; org_id?: string; slug?: string | null; tenant_name?: string | null; logo_url?: string | null; company_name?: string | null; accent_color?: string; welcome_message?: string | null; sla_info?: string | null; contact_email?: string | null; contact_phone?: string | null; footer_text?: string | null; visible_sections?: Json; show_branding?: boolean; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "portal_config_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organisations"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_org_id: { Args: Record<string, never>; Returns: string }
      create_organisation: { Args: { org_name: string }; Returns: Json }
      cleanup_expired_submissions: { Args: Record<string, never>; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
