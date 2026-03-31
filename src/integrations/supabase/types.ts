export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      agent_submissions: {
        Row: {
          agent_id: string;
          created_at: string;
          customer_name: string;
          drift: Json | null;
          finding_titles: string[];
          findings_summary: Json;
          firewalls: Json;
          full_analysis: Json | null;
          id: string;
          org_id: string;
          overall_grade: string;
          overall_score: number;
          raw_config: Json | null;
          threat_status: Json | null;
        };
        Insert: {
          agent_id: string;
          created_at?: string;
          customer_name?: string;
          drift?: Json | null;
          finding_titles?: string[];
          findings_summary?: Json;
          firewalls?: Json;
          full_analysis?: Json | null;
          id?: string;
          org_id: string;
          overall_grade?: string;
          overall_score?: number;
          raw_config?: Json | null;
          threat_status?: Json | null;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          customer_name?: string;
          drift?: Json | null;
          finding_titles?: string[];
          findings_summary?: Json;
          firewalls?: Json;
          full_analysis?: Json | null;
          id?: string;
          org_id?: string;
          overall_grade?: string;
          overall_score?: number;
          raw_config?: Json | null;
          threat_status?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_submissions_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_submissions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          api_key_hash: string;
          api_key_prefix: string;
          central_firewall_id: string | null;
          connector_version: string | null;
          created_at: string;
          customer_name: string;
          environment: string;
          error_message: string | null;
          firewall_host: string;
          firewall_port: number;
          firmware_version: string | null;
          firmware_version_override: string | null;
          hardware_model: string | null;
          id: string;
          last_grade: string | null;
          last_score: number | null;
          last_seen_at: string | null;
          name: string;
          org_id: string;
          pending_command: string | null;
          schedule_cron: string;
          serial_number: string | null;
          status: string;
          tenant_id: string | null;
          tenant_name: string | null;
        };
        Insert: {
          api_key_hash: string;
          api_key_prefix: string;
          central_firewall_id?: string | null;
          connector_version?: string | null;
          created_at?: string;
          customer_name?: string;
          environment?: string;
          error_message?: string | null;
          firewall_host: string;
          firewall_port?: number;
          firmware_version?: string | null;
          firmware_version_override?: string | null;
          hardware_model?: string | null;
          id?: string;
          last_grade?: string | null;
          last_score?: number | null;
          last_seen_at?: string | null;
          name: string;
          org_id: string;
          pending_command?: string | null;
          schedule_cron?: string;
          serial_number?: string | null;
          status?: string;
          tenant_id?: string | null;
          tenant_name?: string | null;
        };
        Update: {
          api_key_hash?: string;
          api_key_prefix?: string;
          central_firewall_id?: string | null;
          connector_version?: string | null;
          created_at?: string;
          customer_name?: string;
          environment?: string;
          error_message?: string | null;
          firewall_host?: string;
          firewall_port?: number;
          firmware_version?: string | null;
          firmware_version_override?: string | null;
          hardware_model?: string | null;
          id?: string;
          last_grade?: string | null;
          last_score?: number | null;
          last_seen_at?: string | null;
          name?: string;
          org_id?: string;
          pending_command?: string | null;
          schedule_cron?: string;
          serial_number?: string | null;
          status?: string;
          tenant_id?: string | null;
          tenant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agents_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_rules: {
        Row: {
          channel: string;
          config: Json;
          created_at: string;
          enabled: boolean;
          event_type: string;
          id: string;
          org_id: string;
        };
        Insert: {
          channel: string;
          config?: Json;
          created_at?: string;
          enabled?: boolean;
          event_type: string;
          id?: string;
          org_id: string;
        };
        Update: {
          channel?: string;
          config?: Json;
          created_at?: string;
          enabled?: boolean;
          event_type?: string;
          id?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_rules_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_name: string;
          environment: string;
          firewalls: Json;
          id: string;
          org_id: string;
          overall_grade: string;
          overall_score: number;
          reviewer_signed_at: string | null;
          reviewer_signed_by: string | null;
          reviewer_signoff_notes: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          environment?: string;
          firewalls?: Json;
          id?: string;
          org_id: string;
          overall_grade?: string;
          overall_score?: number;
          reviewer_signed_at?: string | null;
          reviewer_signed_by?: string | null;
          reviewer_signoff_notes?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          environment?: string;
          firewalls?: Json;
          id?: string;
          org_id?: string;
          overall_grade?: string;
          overall_score?: number;
          reviewer_signed_at?: string | null;
          reviewer_signed_by?: string | null;
          reviewer_signoff_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          metadata: Json;
          org_id: string;
          resource_id: string;
          resource_type: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          org_id: string;
          resource_id?: string;
          resource_type?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          org_id?: string;
          resource_id?: string;
          resource_type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      autotask_psa_credentials: {
        Row: {
          api_zone_base_url: string;
          connected_at: string;
          default_priority: number;
          default_queue_id: number;
          default_source: number;
          default_status: number;
          default_ticket_type: number;
          encrypted_integration_code: string;
          encrypted_secret: string;
          org_id: string;
          username: string;
        };
        Insert: {
          api_zone_base_url: string;
          connected_at?: string;
          default_priority: number;
          default_queue_id: number;
          default_source: number;
          default_status: number;
          default_ticket_type: number;
          encrypted_integration_code: string;
          encrypted_secret: string;
          org_id: string;
          username: string;
        };
        Update: {
          api_zone_base_url?: string;
          connected_at?: string;
          default_priority?: number;
          default_queue_id?: number;
          default_source?: number;
          default_status?: number;
          default_ticket_type?: number;
          encrypted_integration_code?: string;
          encrypted_secret?: string;
          org_id?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "autotask_psa_credentials_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      central_credentials: {
        Row: {
          api_hosts: Json;
          connected_at: string;
          encrypted_client_id: string;
          encrypted_client_secret: string;
          last_synced_at: string | null;
          org_id: string;
          partner_id: string;
          partner_type: string;
        };
        Insert: {
          api_hosts?: Json;
          connected_at?: string;
          encrypted_client_id: string;
          encrypted_client_secret: string;
          last_synced_at?: string | null;
          org_id: string;
          partner_id?: string;
          partner_type?: string;
        };
        Update: {
          api_hosts?: Json;
          connected_at?: string;
          encrypted_client_id?: string;
          encrypted_client_secret?: string;
          last_synced_at?: string | null;
          org_id?: string;
          partner_id?: string;
          partner_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_credentials_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      central_firewalls: {
        Row: {
          central_tenant_id: string;
          cluster_json: Json | null;
          external_ips: Json;
          firewall_id: string;
          firmware_version: string;
          geo_location: Json | null;
          group_json: Json | null;
          hostname: string;
          id: string;
          model: string;
          name: string;
          org_id: string;
          serial_number: string;
          status_json: Json;
          synced_at: string;
        };
        Insert: {
          central_tenant_id: string;
          cluster_json?: Json | null;
          external_ips?: Json;
          firewall_id: string;
          firmware_version?: string;
          geo_location?: Json | null;
          group_json?: Json | null;
          hostname?: string;
          id?: string;
          model?: string;
          name?: string;
          org_id: string;
          serial_number?: string;
          status_json?: Json;
          synced_at?: string;
        };
        Update: {
          central_tenant_id?: string;
          cluster_json?: Json | null;
          external_ips?: Json;
          firewall_id?: string;
          firmware_version?: string;
          geo_location?: Json | null;
          group_json?: Json | null;
          hostname?: string;
          id?: string;
          model?: string;
          name?: string;
          org_id?: string;
          serial_number?: string;
          status_json?: Json;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_firewalls_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      central_tenants: {
        Row: {
          api_host: string;
          billing_type: string;
          central_tenant_id: string;
          data_region: string;
          id: string;
          name: string;
          org_id: string;
          synced_at: string;
        };
        Insert: {
          api_host?: string;
          billing_type?: string;
          central_tenant_id: string;
          data_region?: string;
          id?: string;
          name?: string;
          org_id: string;
          synced_at?: string;
        };
        Update: {
          api_host?: string;
          billing_type?: string;
          central_tenant_id?: string;
          data_region?: string;
          id?: string;
          name?: string;
          org_id?: string;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_tenants_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      config_upload_requests: {
        Row: {
          central_client_id_enc: string | null;
          central_client_secret_enc: string | null;
          central_connected_at: string | null;
          central_data: Json | null;
          central_linked_firewall_id: string | null;
          central_linked_firewall_name: string | null;
          config_xml: string | null;
          contact_name: string | null;
          created_at: string;
          customer_email: string | null;
          customer_name: string | null;
          downloaded_at: string | null;
          email_sent: boolean;
          expires_at: string;
          file_name: string | null;
          id: string;
          reminder_sent: boolean;
          se_email: string | null;
          se_user_id: string;
          status: string;
          team_id: string | null;
          token: string;
          uploaded_at: string | null;
        };
        Insert: {
          central_client_id_enc?: string | null;
          central_client_secret_enc?: string | null;
          central_connected_at?: string | null;
          central_data?: Json | null;
          central_linked_firewall_id?: string | null;
          central_linked_firewall_name?: string | null;
          config_xml?: string | null;
          contact_name?: string | null;
          created_at?: string;
          customer_email?: string | null;
          customer_name?: string | null;
          downloaded_at?: string | null;
          email_sent?: boolean;
          expires_at: string;
          file_name?: string | null;
          id?: string;
          reminder_sent?: boolean;
          se_email?: string | null;
          se_user_id: string;
          status?: string;
          team_id?: string | null;
          token?: string;
          uploaded_at?: string | null;
        };
        Update: {
          central_client_id_enc?: string | null;
          central_client_secret_enc?: string | null;
          central_connected_at?: string | null;
          central_data?: Json | null;
          central_linked_firewall_id?: string | null;
          central_linked_firewall_name?: string | null;
          config_xml?: string | null;
          contact_name?: string | null;
          created_at?: string;
          customer_email?: string | null;
          customer_name?: string | null;
          downloaded_at?: string | null;
          email_sent?: boolean;
          expires_at?: string;
          file_name?: string | null;
          id?: string;
          reminder_sent?: boolean;
          se_email?: string | null;
          se_user_id?: string;
          status?: string;
          team_id?: string | null;
          token?: string;
          uploaded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "config_upload_requests_se_user_id_fkey";
            columns: ["se_user_id"];
            isOneToOne: false;
            referencedRelation: "se_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "config_upload_requests_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "se_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      connectwise_cloud_credentials: {
        Row: {
          connected_at: string;
          encrypted_public_member_id: string;
          encrypted_subscription_key: string;
          last_error: string | null;
          last_token_ok_at: string | null;
          org_id: string;
          public_id_suffix: string;
          scope: string;
        };
        Insert: {
          connected_at?: string;
          encrypted_public_member_id: string;
          encrypted_subscription_key: string;
          last_error?: string | null;
          last_token_ok_at?: string | null;
          org_id: string;
          public_id_suffix?: string;
          scope?: string;
        };
        Update: {
          connected_at?: string;
          encrypted_public_member_id?: string;
          encrypted_subscription_key?: string;
          last_error?: string | null;
          last_token_ok_at?: string | null;
          org_id?: string;
          public_id_suffix?: string;
          scope?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connectwise_cloud_credentials_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      connectwise_manage_credentials: {
        Row: {
          api_base_url: string;
          connected_at: string;
          default_board_id: number;
          default_status_id: number;
          encrypted_private_key: string;
          encrypted_public_key: string;
          integrator_company_id: string;
          org_id: string;
        };
        Insert: {
          api_base_url: string;
          connected_at?: string;
          default_board_id: number;
          default_status_id?: number;
          encrypted_private_key: string;
          encrypted_public_key: string;
          integrator_company_id: string;
          org_id: string;
        };
        Update: {
          api_base_url?: string;
          connected_at?: string;
          default_board_id?: number;
          default_status_id?: number;
          encrypted_private_key?: string;
          encrypted_public_key?: string;
          integrator_company_id?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connectwise_manage_credentials_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      finding_snapshots: {
        Row: {
          created_at: string;
          hostname: string;
          id: string;
          org_id: string;
          score: number;
          titles: string[];
        };
        Insert: {
          created_at?: string;
          hostname: string;
          id?: string;
          org_id: string;
          score?: number;
          titles?: string[];
        };
        Update: {
          created_at?: string;
          hostname?: string;
          id?: string;
          org_id?: string;
          score?: number;
          titles?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "finding_snapshots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      firewall_config_links: {
        Row: {
          central_firewall_id: string;
          central_tenant_id: string;
          config_hash: string;
          config_hostname: string;
          id: string;
          linked_at: string;
          linked_by: string | null;
          org_id: string;
        };
        Insert: {
          central_firewall_id: string;
          central_tenant_id: string;
          config_hash?: string;
          config_hostname?: string;
          id?: string;
          linked_at?: string;
          linked_by?: string | null;
          org_id: string;
        };
        Update: {
          central_firewall_id?: string;
          central_tenant_id?: string;
          config_hash?: string;
          config_hostname?: string;
          id?: string;
          linked_at?: string;
          linked_by?: string | null;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "firewall_config_links_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      gemini_usage: {
        Row: {
          completion_tokens: number | null;
          created_at: string;
          id: string;
          is_chat: boolean;
          model: string | null;
          prompt_tokens: number | null;
          total_tokens: number;
          user_id: string | null;
        };
        Insert: {
          completion_tokens?: number | null;
          created_at?: string;
          id?: string;
          is_chat?: boolean;
          model?: string | null;
          prompt_tokens?: number | null;
          total_tokens: number;
          user_id?: string | null;
        };
        Update: {
          completion_tokens?: number | null;
          created_at?: string;
          id?: string;
          is_chat?: boolean;
          model?: string | null;
          prompt_tokens?: number | null;
          total_tokens?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      org_invites: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          id: string;
          joined_at: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_service_api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          key_hash: string;
          key_prefix: string;
          label: string;
          last_used_at: string | null;
          org_id: string;
          revoked_at: string | null;
          scopes: string[];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key_hash: string;
          key_prefix: string;
          label: string;
          last_used_at?: string | null;
          org_id: string;
          revoked_at?: string | null;
          scopes?: string[];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          label?: string;
          last_used_at?: string | null;
          org_id?: string;
          revoked_at?: string | null;
          scopes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "org_service_api_keys_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      organisations: {
        Row: {
          created_at: string;
          id: string;
          mfa_required: boolean;
          name: string;
          report_template: Json | null;
          submission_retention_days: number;
          webhook_secret: string | null;
          webhook_url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mfa_required?: boolean;
          name: string;
          report_template?: Json | null;
          submission_retention_days?: number;
          webhook_secret?: string | null;
          webhook_url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          mfa_required?: boolean;
          name?: string;
          report_template?: Json | null;
          submission_retention_days?: number;
          webhook_secret?: string | null;
          webhook_url?: string | null;
        };
        Relationships: [];
      };
      passkey_credentials: {
        Row: {
          counter: number;
          created_at: string;
          credential_id: string;
          device_type: string;
          id: string;
          name: string;
          public_key: string;
          transports: string[];
          user_id: string;
        };
        Insert: {
          counter?: number;
          created_at?: string;
          credential_id: string;
          device_type?: string;
          id?: string;
          name?: string;
          public_key: string;
          transports?: string[];
          user_id: string;
        };
        Update: {
          counter?: number;
          created_at?: string;
          credential_id?: string;
          device_type?: string;
          id?: string;
          name?: string;
          public_key?: string;
          transports?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      portal_config: {
        Row: {
          accent_color: string | null;
          company_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string | null;
          footer_text: string | null;
          id: string;
          logo_url: string | null;
          org_id: string;
          show_branding: boolean | null;
          sla_info: string | null;
          slug: string | null;
          tenant_name: string | null;
          updated_at: string | null;
          visible_sections: Json | null;
          welcome_message: string | null;
        };
        Insert: {
          accent_color?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          footer_text?: string | null;
          id?: string;
          logo_url?: string | null;
          org_id: string;
          show_branding?: boolean | null;
          sla_info?: string | null;
          slug?: string | null;
          tenant_name?: string | null;
          updated_at?: string | null;
          visible_sections?: Json | null;
          welcome_message?: string | null;
        };
        Update: {
          accent_color?: string | null;
          company_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          footer_text?: string | null;
          id?: string;
          logo_url?: string | null;
          org_id?: string;
          show_branding?: boolean | null;
          sla_info?: string | null;
          slug?: string | null;
          tenant_name?: string | null;
          updated_at?: string | null;
          visible_sections?: Json | null;
          welcome_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_config_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_viewers: {
        Row: {
          email: string;
          id: string;
          invited_at: string;
          invited_by: string | null;
          last_login_at: string | null;
          name: string | null;
          org_id: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          email: string;
          id?: string;
          invited_at?: string;
          invited_by?: string | null;
          last_login_at?: string | null;
          name?: string | null;
          org_id: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          email?: string;
          id?: string;
          invited_at?: string;
          invited_by?: string | null;
          last_login_at?: string | null;
          name?: string | null;
          org_id?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_viewers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      psa_customer_company_map: {
        Row: {
          company_id: number;
          customer_key: string;
          org_id: string;
          provider: string;
          updated_at: string;
        };
        Insert: {
          company_id: number;
          customer_key: string;
          org_id: string;
          provider?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: number;
          customer_key?: string;
          org_id?: string;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "psa_customer_company_map_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      psa_ticket_idempotency: {
        Row: {
          created_at: string;
          external_ticket_id: string;
          id: string;
          idempotency_key: string;
          metadata: Json;
          org_id: string;
          provider: string;
        };
        Insert: {
          created_at?: string;
          external_ticket_id: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          org_id: string;
          provider?: string;
        };
        Update: {
          created_at?: string;
          external_ticket_id?: string;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          org_id?: string;
          provider?: string;
        };
        Relationships: [
          {
            foreignKeyName: "psa_ticket_idempotency_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      regulatory_updates: {
        Row: {
          created_at: string | null;
          framework: string | null;
          id: string;
          link: string;
          published_at: string | null;
          source: string;
          summary: string;
          title: string;
        };
        Insert: {
          created_at?: string | null;
          framework?: string | null;
          id?: string;
          link: string;
          published_at?: string | null;
          source: string;
          summary: string;
          title: string;
        };
        Update: {
          created_at?: string | null;
          framework?: string | null;
          id?: string;
          link?: string;
          published_at?: string | null;
          source?: string;
          summary?: string;
          title?: string;
        };
        Relationships: [];
      };
      remediation_status: {
        Row: {
          completed_at: string;
          completed_by: string | null;
          customer_hash: string;
          id: string;
          org_id: string;
          playbook_id: string;
        };
        Insert: {
          completed_at?: string;
          completed_by?: string | null;
          customer_hash: string;
          id?: string;
          org_id: string;
          playbook_id: string;
        };
        Update: {
          completed_at?: string;
          completed_by?: string | null;
          customer_hash?: string;
          id?: string;
          org_id?: string;
          playbook_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "remediation_status_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_reports: {
        Row: {
          analysis_summary: Json;
          created_at: string;
          created_by: string | null;
          customer_name: string;
          environment: string;
          id: string;
          org_id: string;
          report_type: string;
          reports: Json;
        };
        Insert: {
          analysis_summary?: Json;
          created_at?: string;
          created_by?: string | null;
          customer_name: string;
          environment?: string;
          id?: string;
          org_id: string;
          report_type?: string;
          reports?: Json;
        };
        Update: {
          analysis_summary?: Json;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          environment?: string;
          id?: string;
          org_id?: string;
          report_type?: string;
          reports?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "saved_reports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_reports: {
        Row: {
          created_at: string;
          customer_name: string | null;
          enabled: boolean;
          id: string;
          include_sections: Json;
          last_sent_at: string | null;
          name: string;
          next_due_at: string;
          org_id: string;
          recipients: string[];
          report_type: string;
          schedule: string;
        };
        Insert: {
          created_at?: string;
          customer_name?: string | null;
          enabled?: boolean;
          id?: string;
          include_sections?: Json;
          last_sent_at?: string | null;
          name: string;
          next_due_at?: string;
          org_id: string;
          recipients?: string[];
          report_type?: string;
          schedule: string;
        };
        Update: {
          created_at?: string;
          customer_name?: string | null;
          enabled?: boolean;
          id?: string;
          include_sections?: Json;
          last_sent_at?: string | null;
          name?: string;
          next_due_at?: string;
          org_id?: string;
          recipients?: string[];
          report_type?: string;
          schedule?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      score_history: {
        Row: {
          assessed_at: string;
          category_scores: Json;
          customer_name: string;
          findings_count: number;
          hostname: string;
          id: string;
          org_id: string;
          overall_grade: string;
          overall_score: number;
        };
        Insert: {
          assessed_at?: string;
          category_scores?: Json;
          customer_name?: string;
          findings_count?: number;
          hostname: string;
          id?: string;
          org_id: string;
          overall_grade?: string;
          overall_score: number;
        };
        Update: {
          assessed_at?: string;
          category_scores?: Json;
          customer_name?: string;
          findings_count?: number;
          hostname?: string;
          id?: string;
          org_id?: string;
          overall_grade?: string;
          overall_score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "score_history_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      se_health_checks: {
        Row: {
          checked_at: string;
          customer_name: string | null;
          findings_count: number | null;
          firewall_count: number | null;
          followup_at: string | null;
          followup_sent: boolean | null;
          id: string;
          overall_grade: string | null;
          overall_score: number | null;
          se_user_id: string;
          serial_numbers: string[];
          share_expires_at: string | null;
          share_token: string | null;
          shared_html: string | null;
          summary_json: Json | null;
          team_id: string | null;
        };
        Insert: {
          checked_at?: string;
          customer_name?: string | null;
          findings_count?: number | null;
          firewall_count?: number | null;
          followup_at?: string | null;
          followup_sent?: boolean | null;
          id?: string;
          overall_grade?: string | null;
          overall_score?: number | null;
          se_user_id: string;
          serial_numbers?: string[];
          share_expires_at?: string | null;
          share_token?: string | null;
          shared_html?: string | null;
          summary_json?: Json | null;
          team_id?: string | null;
        };
        Update: {
          checked_at?: string;
          customer_name?: string | null;
          findings_count?: number | null;
          firewall_count?: number | null;
          followup_at?: string | null;
          followup_sent?: boolean | null;
          id?: string;
          overall_grade?: string | null;
          overall_score?: number | null;
          se_user_id?: string;
          serial_numbers?: string[];
          share_expires_at?: string | null;
          share_token?: string | null;
          shared_html?: string | null;
          summary_json?: Json | null;
          team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "se_health_checks_se_user_id_fkey";
            columns: ["se_user_id"];
            isOneToOne: false;
            referencedRelation: "se_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "se_health_checks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "se_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      se_profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string;
          health_check_prepared_by: string | null;
          id: string;
          profile_completed: boolean;
          se_title: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email: string;
          health_check_prepared_by?: string | null;
          id?: string;
          profile_completed?: boolean;
          se_title?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string;
          health_check_prepared_by?: string | null;
          id?: string;
          profile_completed?: boolean;
          se_title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      se_team_invites: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          status: string;
          team_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          status?: string;
          team_id: string;
          token?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          status?: string;
          team_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "se_team_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "se_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "se_team_invites_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "se_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      se_team_members: {
        Row: {
          id: string;
          is_primary: boolean;
          joined_at: string;
          role: string;
          se_profile_id: string;
          team_id: string;
        };
        Insert: {
          id?: string;
          is_primary?: boolean;
          joined_at?: string;
          role?: string;
          se_profile_id: string;
          team_id: string;
        };
        Update: {
          id?: string;
          is_primary?: boolean;
          joined_at?: string;
          role?: string;
          se_profile_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "se_team_members_se_profile_id_fkey";
            columns: ["se_profile_id"];
            isOneToOne: false;
            referencedRelation: "se_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "se_team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "se_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      se_teams: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "se_teams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "se_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shared_reports: {
        Row: {
          advisor_notes: string | null;
          allow_download: boolean;
          created_at: string;
          created_by: string | null;
          customer_name: string;
          expires_at: string;
          id: string;
          markdown: string;
          org_id: string;
          share_token: string;
        };
        Insert: {
          advisor_notes?: string | null;
          allow_download?: boolean;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          expires_at: string;
          id?: string;
          markdown: string;
          org_id: string;
          share_token: string;
        };
        Update: {
          advisor_notes?: string | null;
          allow_download?: boolean;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          expires_at?: string;
          id?: string;
          markdown?: string;
          org_id?: string;
          share_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_reports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_expired_submissions: { Args: never; Returns: number };
      create_organisation: { Args: { org_name: string }; Returns: Json };
      get_my_team_ids: { Args: never; Returns: string[] };
      is_team_admin: { Args: { p_team_id: string }; Returns: boolean };
      user_org_id: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
