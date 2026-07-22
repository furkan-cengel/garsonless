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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_customers: {
        Row: {
          contact_email: string
          created_at: string
          id: string
          legal_name: string
          provider: string
          provider_customer_ref: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          id?: string
          legal_name: string
          provider?: string
          provider_customer_ref?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          legal_name?: string
          provider?: string
          provider_customer_ref?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_platform_policies: {
        Row: {
          cancelled_retention_days: number
          created_at: string
          final_warning_after_days: number
          id: string
          pre_due_reminder_days: number
          retry_after_days: number
          second_warning_after_days: number
          suspend_after_days: number
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancelled_retention_days: number
          created_at?: string
          final_warning_after_days: number
          id?: string
          pre_due_reminder_days: number
          retry_after_days: number
          second_warning_after_days: number
          suspend_after_days: number
          trial_days: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancelled_retention_days?: number
          created_at?: string
          final_warning_after_days?: number
          id?: string
          pre_due_reminder_days?: number
          retry_after_days?: number
          second_warning_after_days?: number
          suspend_after_days?: number
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      billing_provider_events: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          payload_hash: string
          payload_sanitized: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          restaurant_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload_hash: string
          payload_sanitized?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id: string
          received_at?: string
          restaurant_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload_hash?: string
          payload_sanitized?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          restaurant_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_provider_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_provider_events_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "billing_provider_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_reconciliation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          dedupe_key: string
          discrepancy_code: string | null
          id: string
          last_error: string | null
          local_snapshot: Json
          locked_at: string | null
          locked_by: string | null
          provider: string
          provider_snapshot_sanitized: Json
          restaurant_id: string | null
          scheduled_at: string
          scope: string
          started_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          discrepancy_code?: string | null
          id?: string
          last_error?: string | null
          local_snapshot?: Json
          locked_at?: string | null
          locked_by?: string | null
          provider?: string
          provider_snapshot_sanitized?: Json
          restaurant_id?: string | null
          scheduled_at?: string
          scope: string
          started_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          discrepancy_code?: string | null
          id?: string
          last_error?: string | null
          local_snapshot?: Json
          locked_at?: string | null
          locked_by?: string | null
          provider?: string
          provider_snapshot_sanitized?: Json
          restaurant_id?: string | null
          scheduled_at?: string
          scope?: string
          started_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_reconciliation_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_reconciliation_jobs_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "billing_reconciliation_jobs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          billing_anchor_day: number
          billing_customer_id: string
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_at: string | null
          id: string
          plan: string
          provider: string
          provider_subscription_ref: string | null
          restaurant_id: string
          scheduled_plan: string | null
          status: string
          suspended_at: string | null
          trial_ends_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          billing_anchor_day?: number
          billing_customer_id: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          plan: string
          provider?: string
          provider_subscription_ref?: string | null
          restaurant_id: string
          scheduled_plan?: string | null
          status: string
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          billing_anchor_day?: number
          billing_customer_id?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          plan?: string
          provider?: string
          provider_subscription_ref?: string | null
          restaurant_id?: string
          scheduled_plan?: string | null
          status?: string
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_restaurant_id_billing_customer_id_fkey"
            columns: ["restaurant_id", "billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "billing_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          created_at: string
          customer_id: string
          error: string | null
          id: string
          locked_at: string | null
          phone: string
          provider_message_id: string | null
          restaurant_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          locked_at?: string | null
          phone: string
          provider_message_id?: string | null
          restaurant_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          locked_at?: string | null
          phone?: string
          provider_message_id?: string | null
          restaurant_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          builtin_segment: string | null
          channel: string
          created_at: string
          created_by: string | null
          custom_segment_id: string | null
          deleted_at: string | null
          failed_count: number
          id: string
          message_body: string
          name: string
          recipient_count: number
          restaurant_id: string
          segment_definition: Json
          segment_kind: string
          sent_at: string | null
          sent_count: number
          skipped_count: number
          status: string
          updated_at: string
        }
        Insert: {
          builtin_segment?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          custom_segment_id?: string | null
          deleted_at?: string | null
          failed_count?: number
          id?: string
          message_body: string
          name: string
          recipient_count?: number
          restaurant_id: string
          segment_definition?: Json
          segment_kind?: string
          sent_at?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          builtin_segment?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          custom_segment_id?: string | null
          deleted_at?: string | null
          failed_count?: number
          id?: string
          message_body?: string
          name?: string
          recipient_count?: number
          restaurant_id?: string
          segment_definition?: Json
          segment_kind?: string
          sent_at?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_custom_segment_id_fkey"
            columns: ["custom_segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents: {
        Row: {
          consent_type: string
          created_at: string
          customer_id: string
          granted_at: string | null
          id: string
          restaurant_id: string
          revoked_at: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          consent_type?: string
          created_at?: string
          customer_id: string
          granted_at?: string | null
          id?: string
          restaurant_id: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          customer_id?: string
          granted_at?: string | null
          id?: string
          restaurant_id?: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_restaurants: {
        Row: {
          customer_id: string
          linked_at: string
          restaurant_id: string
          source: string
        }
        Insert: {
          customer_id: string
          linked_at?: string
          restaurant_id: string
          source: string
        }
        Update: {
          customer_id?: string
          linked_at?: string
          restaurant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_restaurants_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          deleted_at: string | null
          id: string
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          deleted_at?: string | null
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          deleted_at?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          verified_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      dashboard_push_deliveries: {
        Row: {
          attempts: number
          created_at: string
          last_error: string | null
          outbox_id: string
          sent_at: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          outbox_id: string
          sent_at?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          outbox_id?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_push_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "domain_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "dashboard_push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          endpoint_hash: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          restaurant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          endpoint_hash: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          restaurant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          endpoint_hash?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          restaurant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_query_observations: {
        Row: {
          created_at: string
          duration_ms: number
          error: string | null
          id: number
          issue_count: number
          operation: string
          outcome: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          error?: string | null
          id?: never
          issue_count?: number
          operation: string
          outcome: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: never
          issue_count?: number
          operation?: string
          outcome?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_query_observations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_outbox: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          dead_lettered_at: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          occurred_at: string
          payload: Json
          processed_at: string | null
          restaurant_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          dead_lettered_at?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          restaurant_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          dead_lettered_at?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_outbox_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_outbox_receipts: {
        Row: {
          consumer: string
          outbox_id: string
          processed_at: string
        }
        Insert: {
          consumer: string
          outbox_id: string
          processed_at?: string
        }
        Update: {
          consumer?: string
          outbox_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_outbox_receipts_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "domain_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_runs: {
        Row: {
          attempts: number
          created_at: string
          current_step: string
          id: string
          invoice_id: string
          last_action_at: string | null
          last_error: string | null
          next_action_at: string | null
          policy_id: string
          policy_snapshot: Json
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          current_step?: string
          id?: string
          invoice_id: string
          last_action_at?: string | null
          last_error?: string | null
          next_action_at?: string | null
          policy_id?: string
          policy_snapshot: Json
          restaurant_id: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          current_step?: string
          id?: string
          invoice_id?: string
          last_action_at?: string | null
          last_error?: string | null
          next_action_at?: string | null
          policy_id?: string
          policy_snapshot?: Json
          restaurant_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_runs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "billing_platform_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_runs_restaurant_id_subscription_id_invoice_id_fkey"
            columns: ["restaurant_id", "subscription_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "subscription_id", "id"]
          },
        ]
      }
      kitchen_credentials: {
        Row: {
          created_at: string
          restaurant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_credentials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_session_launches: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          restaurant_id: string
          ticket_hash: string
          updated_at: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          restaurant_id: string
          ticket_hash: string
          updated_at?: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
          ticket_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_session_launches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_stations: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_id: string
          delta: number
          direction: string
          granted_by: string | null
          id: string
          order_id: string | null
          reason: string
          restaurant_id: string
          scope_key: string
          session_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delta: number
          direction?: string
          granted_by?: string | null
          id?: string
          order_id?: string | null
          reason: string
          restaurant_id: string
          scope_key: string
          session_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delta?: number
          direction?: string
          granted_by?: string | null
          id?: string
          order_id?: string | null
          reason?: string
          restaurant_id?: string
          scope_key?: string
          session_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          kitchen_station_id: string | null
          name: string
          parent_id: string | null
          position: number
          restaurant_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          kitchen_station_id?: string | null
          name: string
          parent_id?: string | null
          position?: number
          restaurant_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          kitchen_station_id?: string | null
          name?: string
          parent_id?: string | null
          position?: number
          restaurant_id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergen_note: string | null
          carb_g: number | null
          category_id: string
          contains_alcohol: boolean
          contains_allergens: string[]
          contains_pork: boolean
          cost: number | null
          created_at: string
          cross_contact_note: string | null
          deleted_at: string | null
          description: string | null
          earns_stamp: boolean
          energy_kcal: number | null
          fat_g: number | null
          food_info_reviewed_at: string | null
          food_info_reviewed_by: string | null
          id: string
          images: Json
          ingredients: Json
          is_available: boolean
          is_halal: boolean
          is_vegan: boolean
          is_vegetarian: boolean
          kitchen_station_id: string | null
          may_contain_allergens: string[]
          modifier_groups: Json
          name: string
          position: number
          price: number
          protein_g: number | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          allergen_note?: string | null
          carb_g?: number | null
          category_id: string
          contains_alcohol?: boolean
          contains_allergens?: string[]
          contains_pork?: boolean
          cost?: number | null
          created_at?: string
          cross_contact_note?: string | null
          deleted_at?: string | null
          description?: string | null
          earns_stamp?: boolean
          energy_kcal?: number | null
          fat_g?: number | null
          food_info_reviewed_at?: string | null
          food_info_reviewed_by?: string | null
          id?: string
          images?: Json
          ingredients?: Json
          is_available?: boolean
          is_halal?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          kitchen_station_id?: string | null
          may_contain_allergens?: string[]
          modifier_groups?: Json
          name: string
          position?: number
          price: number
          protein_g?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          allergen_note?: string | null
          carb_g?: number | null
          category_id?: string
          contains_alcohol?: boolean
          contains_allergens?: string[]
          contains_pork?: boolean
          cost?: number | null
          created_at?: string
          cross_contact_note?: string | null
          deleted_at?: string | null
          description?: string | null
          earns_stamp?: boolean
          energy_kcal?: number | null
          fat_g?: number | null
          food_info_reviewed_at?: string | null
          food_info_reviewed_by?: string | null
          id?: string
          images?: Json
          ingredients?: Json
          is_available?: boolean
          is_halal?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          kitchen_station_id?: string | null
          may_contain_allergens?: string[]
          modifier_groups?: Json
          name?: string
          position?: number
          price?: number
          protein_g?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_kitchen_station_id_fkey"
            columns: ["kitchen_station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_events: {
        Row: {
          campaign_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          error: string | null
          event_type: string
          id: string
          metadata: Json
          phone: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_id: string | null
          restaurant_id: string
        }
        Insert: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          error?: string | null
          event_type: string
          id?: string
          metadata?: Json
          phone?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          restaurant_id: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          error?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          phone?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          category: string
          channel: string
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          outbox_id: string | null
          provider_message_id: string | null
          recipient_address: string
          recipient_user_id: string
          restaurant_id: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          category: string
          channel: string
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          outbox_id?: string | null
          provider_message_id?: string | null
          recipient_address: string
          recipient_user_id: string
          restaurant_id: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          category?: string
          channel?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          outbox_id?: string | null
          provider_message_id?: string | null
          recipient_address?: string
          recipient_user_id?: string
          restaurant_id?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "domain_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_inbox: {
        Row: {
          body: string
          category: string
          created_at: string
          dedupe_key: string
          id: string
          link_path: string | null
          outbox_id: string | null
          read_at: string | null
          recipient_user_id: string
          restaurant_id: string
          severity: string
          title: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          dedupe_key: string
          id?: string
          link_path?: string | null
          outbox_id?: string | null
          read_at?: string | null
          recipient_user_id: string
          restaurant_id: string
          severity?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          link_path?: string | null
          outbox_id?: string | null
          read_at?: string | null
          recipient_user_id?: string
          restaurant_id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_inbox_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "domain_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_inbox_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          prefs: Json
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_html: string
          category: string
          channel: string
          id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          category: string
          channel: string
          id?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          category?: string
          channel?: string
          id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_payment_tokens: {
        Row: {
          created_at: string
          order_id: string
          token: string
        }
        Insert: {
          created_at?: string
          order_id: string
          token: string
        }
        Update: {
          created_at?: string
          order_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_by: string | null
          checkout_amount: number | null
          checkout_reservation_id: string | null
          checkout_reserved_until: string | null
          created_at: string
          customer_id: string | null
          customer_tier: Json | null
          deleted_at: string | null
          discount_breakdown: Json | null
          id: string
          items: Json
          paid_at: string | null
          payment_method: string | null
          ready_at: string | null
          request_id: string | null
          restaurant_id: string
          sent_to_kitchen_at: string | null
          served_at: string | null
          session_id: string
          settled_by: string | null
          status: string
          table_id: string | null
          table_session_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          checkout_amount?: number | null
          checkout_reservation_id?: string | null
          checkout_reserved_until?: string | null
          created_at?: string
          customer_id?: string | null
          customer_tier?: Json | null
          deleted_at?: string | null
          discount_breakdown?: Json | null
          id?: string
          items?: Json
          paid_at?: string | null
          payment_method?: string | null
          ready_at?: string | null
          request_id?: string | null
          restaurant_id: string
          sent_to_kitchen_at?: string | null
          served_at?: string | null
          session_id: string
          settled_by?: string | null
          status?: string
          table_id?: string | null
          table_session_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          checkout_amount?: number | null
          checkout_reservation_id?: string | null
          checkout_reserved_until?: string | null
          created_at?: string
          customer_id?: string | null
          customer_tier?: Json | null
          deleted_at?: string | null
          discount_breakdown?: Json | null
          id?: string
          items?: Json
          paid_at?: string | null
          payment_method?: string | null
          ready_at?: string | null
          request_id?: string | null
          restaurant_id?: string
          sent_to_kitchen_at?: string | null
          served_at?: string | null
          session_id?: string
          settled_by?: string | null
          status?: string
          table_id?: string | null
          table_session_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_table_fkey"
            columns: ["restaurant_id", "table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credentials: {
        Row: {
          api_key: string
          created_at: string
          mode: string
          provider: string
          restaurant_id: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          mode?: string
          provider?: string
          restaurant_id: string
          secret_key: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          mode?: string
          provider?: string
          restaurant_id?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_credentials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliation_events: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          dead_lettered_at: string | null
          detail: Json
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          order_id: string | null
          provider_token_hash: string
          resolved_at: string | null
          restaurant_id: string | null
          share_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          dead_lettered_at?: string | null
          detail?: Json
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          order_id?: string | null
          provider_token_hash: string
          resolved_at?: string | null
          restaurant_id?: string | null
          share_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          dead_lettered_at?: string | null
          detail?: Json
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          order_id?: string | null
          provider_token_hash?: string
          resolved_at?: string | null
          restaurant_id?: string | null
          share_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_events_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "payment_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_share_tokens: {
        Row: {
          created_at: string
          share_id: string
          token: string
        }
        Insert: {
          created_at?: string
          share_id: string
          token: string
        }
        Update: {
          created_at?: string
          share_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_share_tokens_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: true
            referencedRelation: "payment_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_shares: {
        Row: {
          amount: number
          assigned_items: Json | null
          checkout_amount: number | null
          checkout_reserved_until: string | null
          created_at: string
          customer_id: string | null
          id: string
          label: string | null
          method: string | null
          restaurant_id: string
          settled_at: string | null
          settled_by: string | null
          status: string
          table_session_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          assigned_items?: Json | null
          checkout_amount?: number | null
          checkout_reserved_until?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          method?: string | null
          restaurant_id: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          table_session_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assigned_items?: Json | null
          checkout_amount?: number | null
          checkout_reserved_until?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          method?: string | null
          restaurant_id?: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          table_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_shares_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_shares_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_shares_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      public_order_rate_events: {
        Row: {
          created_at: string
          id: number
          key_hash: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          key_hash: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: number
          key_hash?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_order_rate_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_stand_request_limits: {
        Row: {
          last_requested_at: string
          requested_by: string
          restaurant_id: string
        }
        Insert: {
          last_requested_at?: string
          requested_by: string
          restaurant_id: string
        }
        Update: {
          last_requested_at?: string
          requested_by?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_stand_request_limits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invite_expires_at: string | null
          invite_token_hash: string | null
          invited_at: string
          invited_by: string | null
          permissions: Json
          restaurant_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invite_expires_at?: string | null
          invite_token_hash?: string | null
          invited_at?: string
          invited_by?: string | null
          permissions?: Json
          restaurant_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_expires_at?: string | null
          invite_token_hash?: string | null
          invited_at?: string
          invited_by?: string | null
          permissions?: Json
          restaurant_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          restaurant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          restaurant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          restaurant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string
          id: string
          request_type: string
          resolved_at: string | null
          restaurant_id: string
          status: string
          table_id: string
          table_session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          request_type?: string
          resolved_at?: string | null
          restaurant_id: string
          status?: string
          table_id: string
          table_session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          request_type?: string
          resolved_at?: string | null
          restaurant_id?: string
          status?: string
          table_id?: string
          table_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_restaurant_table_fkey"
            columns: ["restaurant_id", "table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "service_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount_due_minor: number
          amount_paid_minor: number
          created_at: string
          currency: string
          due_at: string
          failed_at: string | null
          finalized_at: string | null
          id: string
          idempotency_key: string
          paid_at: string | null
          period_end: string
          period_start: string
          plan: string
          provider: string
          provider_invoice_ref: string | null
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_due_minor: number
          amount_paid_minor?: number
          created_at?: string
          currency?: string
          due_at: string
          failed_at?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          paid_at?: string | null
          period_end: string
          period_start: string
          plan: string
          provider?: string
          provider_invoice_ref?: string | null
          restaurant_id: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_due_minor?: number
          amount_paid_minor?: number
          created_at?: string
          currency?: string
          due_at?: string
          failed_at?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan?: string
          provider?: string
          provider_invoice_ref?: string | null
          restaurant_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      subscription_payment_attempts: {
        Row: {
          amount_minor: number
          attempt_number: number
          attempted_at: string
          completed_at: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          provider: string
          provider_attempt_ref: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          attempt_number: number
          attempted_at?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          provider?: string
          provider_attempt_ref?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          attempt_number?: number
          attempted_at?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          provider?: string
          provider_attempt_ref?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_attempts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_attempts_restaurant_id_invoice_id_fkey"
            columns: ["restaurant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      table_qr_tokens: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          table_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          table_id: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          table_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_qr_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_qr_tokens_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          close_reason: string | null
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          restaurant_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          restaurant_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          restaurant_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_table_fkey"
            columns: ["restaurant_id", "table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          qr_code_url: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          qr_code_url?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          qr_code_url?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_lifecycle_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          occurred_at: string
          reason_code: string
          reason_detail: string | null
          request_id: string
          restaurant_id: string
          subscription_id: string | null
          to_status: string
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          reason_code: string
          reason_detail?: string | null
          request_id: string
          restaurant_id: string
          subscription_id?: string | null
          to_status: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          reason_code?: string
          reason_detail?: string | null
          request_id?: string
          restaurant_id?: string
          subscription_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_lifecycle_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_lifecycle_events_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      theme_configs: {
        Row: {
          component_overrides: Json
          created_at: string
          id: string
          restaurant_id: string
          tokens: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          component_overrides?: Json
          created_at?: string
          id?: string
          restaurant_id: string
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          component_overrides?: Json
          created_at?: string
          id?: string
          restaurant_id?: string
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theme_configs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_domain_outbox: {
        Args: { p_event_id: string; p_worker: string }
        Returns: boolean
      }
      attach_order_checkout_token: {
        Args: {
          p_order_id: string
          p_reservation_id: string
          p_restaurant_id: string
          p_token: string
        }
        Returns: boolean
      }
      attach_split_checkout_token: {
        Args: { p_restaurant_id: string; p_share_id: string; p_token: string }
        Returns: boolean
      }
      claim_campaign_recipient: {
        Args: { p_campaign_id: string; p_restaurant_id: string }
        Returns: {
          attempts: number
          campaign_id: string
          created_at: string
          customer_id: string
          error: string | null
          id: string
          locked_at: string | null
          phone: string
          provider_message_id: string | null
          restaurant_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "campaign_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_domain_outbox: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          dead_lettered_at: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          occurred_at: string
          payload: Json
          processed_at: string | null
          restaurant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "domain_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_payment_reconciliation: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          dead_lettered_at: string | null
          detail: Json
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          order_id: string | null
          provider_token_hash: string
          resolved_at: string | null
          restaurant_id: string | null
          share_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_reconciliation_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_qr_stand_request_slot: {
        Args: {
          p_requested_by: string
          p_restaurant_id: string
          p_window_seconds?: number
        }
        Returns: string
      }
      close_session_if_fully_paid: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      close_table_session_atomic: {
        Args: {
          p_abnormal_reason?: string
          p_restaurant_id: string
          p_session_id: string
        }
        Returns: string
      }
      complete_campaign_recipient: {
        Args: {
          p_created_by: string
          p_error: string
          p_provider: string
          p_provider_message_id: string
          p_recipient_id: string
          p_restaurant_id: string
          p_segment_label: string
          p_success: boolean
        }
        Returns: boolean
      }
      consume_kitchen_launch_ticket: {
        Args: { p_restaurant_id: string; p_ticket_hash: string }
        Returns: boolean
      }
      consume_public_order_rate_limit: {
        Args: {
          p_key_hash: string
          p_max?: number
          p_restaurant_id: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      create_subscription_invoice_atomic: {
        Args: {
          p_amount_minor: number
          p_due_at: string
          p_idempotency_key: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_restaurant_id: string
          p_subscription_id: string
        }
        Returns: Json
      }
      create_table_service_request_atomic: {
        Args: {
          p_request_type: string
          p_restaurant_id: string
          p_table_id: string
        }
        Returns: Json
      }
      create_table_with_plan_limit: {
        Args: { p_label: string; p_restaurant_id: string }
        Returns: {
          outcome: string
          table_id: string
          table_limit: number
          token: string
        }[]
      }
      customer_access_token_hook: { Args: { event: Json }; Returns: Json }
      defer_domain_outbox: {
        Args: {
          p_delay_seconds?: number
          p_event_id: string
          p_reason: string
          p_worker: string
        }
        Returns: boolean
      }
      delete_menu_category: {
        Args: { p_category_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      enqueue_domain_outbox_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_event_type: string
          p_idempotency_key: string
          p_payload: Json
          p_restaurant_id: string
        }
        Returns: undefined
      }
      enqueue_payment_reconciliation: {
        Args: {
          p_detail?: Json
          p_event_type: string
          p_order_id: string
          p_provider_token_hash: string
          p_restaurant_id: string
          p_share_id: string
        }
        Returns: string
      }
      fail_domain_outbox: {
        Args: {
          p_delay_seconds?: number
          p_error: string
          p_event_id: string
          p_worker: string
        }
        Returns: string
      }
      fail_payment_reconciliation: {
        Args: {
          p_delay_seconds?: number
          p_error: string
          p_event_id: string
          p_worker: string
        }
        Returns: string
      }
      finalize_campaign_delivery: {
        Args: { p_campaign_id: string; p_restaurant_id: string }
        Returns: string
      }
      finalize_order_discount: {
        Args: {
          p_catalog_discount: number
          p_catalog_item_name: string
          p_catalog_points_cost: number
          p_customer: string
          p_member_pct: number
          p_order: string
          p_points_rate: number
          p_points_requested: number
          p_preview_total: number
          p_restaurant: string
          p_reward_item_name: string
          p_scope_key: string
          p_stamp_discount: number
          p_stamps_requested: number
          p_subtotal: number
        }
        Returns: {
          discount_breakdown: Json
          final_total: number
        }[]
      }
      finalize_split_if_covered: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      get_dashboard_query_observation_health: {
        Args: { p_since?: string }
        Returns: {
          affected_restaurant_count: number
          degraded_count: number
          failure_count: number
          issue_count: number
          latest_observation_at: string
          observation_count: number
          oldest_observation_at: string
          operation: string
          p95_duration_ms: number
          slow_success_count: number
        }[]
      }
      get_domain_outbox_health: {
        Args: never
        Returns: {
          dead_letter_count: number
          last_processed_at: string
          leased_count: number
          oldest_pending_seconds: number
          pending_count: number
          ready_count: number
        }[]
      }
      get_restaurant_customer_summary: {
        Args: { p_customer_id: string; p_restaurant_id: string }
        Returns: {
          first_seen: string
          last_seen: string
          spend: number
          visits: number
        }[]
      }
      get_restaurant_customers: {
        Args: {
          p_custom_segment?: Json
          p_limit?: number
          p_offset?: number
          p_restaurant_id: string
          p_scope_key: string
          p_search?: string
          p_segment?: string
          p_sort?: string
        }
        Returns: {
          customer_id: string
          first_seen: string
          has_consent: boolean
          last_seen: string
          lifetime_points: number
          name: string
          phone: string
          points: number
          spend: number
          total_count: number
          visits: number
        }[]
      }
      has_restaurant_access: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      has_restaurant_section: {
        Args: { p_restaurant_id: string; p_section: string }
        Returns: boolean
      }
      invoke_domain_outbox_worker: { Args: never; Returns: number }
      is_restaurant_owner: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      is_staff_user: { Args: { p_user_id: string }; Returns: boolean }
      list_active_table_qr_tokens: {
        Args: { p_restaurant_id: string }
        Returns: {
          table_id: string
          token: string
        }[]
      }
      menu_category_restaurant: {
        Args: { p_category_id: string }
        Returns: string
      }
      open_or_get_table_session: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      patch_restaurant_qr_style: {
        Args: { p_qr_style: Json; p_restaurant_id: string }
        Returns: undefined
      }
      patch_restaurant_settings_atomic: {
        Args: { p_patch: Json; p_restaurant_id: string }
        Returns: boolean
      }
      prune_dashboard_query_observations: { Args: never; Returns: number }
      publish_theme_config_atomic: {
        Args: {
          p_published_by: string
          p_restaurant_id: string
          p_template_id: string
          p_tokens: Json
        }
        Returns: string
      }
      queue_campaign_delivery_atomic: {
        Args: {
          p_builtin_segment: string
          p_contacts: Json
          p_created_by: string
          p_custom_segment_id: string
          p_message_body: string
          p_name: string
          p_restaurant_id: string
          p_segment_definition: Json
          p_segment_kind: string
          p_segment_label: string
          p_skipped_count: number
        }
        Returns: string
      }
      read_kitchen_order_projection: {
        Args: { p_after?: string; p_restaurant_id: string }
        Returns: Json
      }
      record_subscription_payment_failure_atomic: {
        Args: {
          p_amount_minor: number
          p_failure_code: string
          p_failure_message: string
          p_idempotency_key: string
          p_invoice_id: string
          p_occurred_at: string
          p_provider_attempt_ref: string
          p_provider_event_id: string
          p_restaurant_id: string
          p_subscription_id: string
        }
        Returns: Json
      }
      record_subscription_payment_success_atomic: {
        Args: {
          p_amount_minor: number
          p_idempotency_key: string
          p_invoice_id: string
          p_occurred_at: string
          p_provider_attempt_ref: string
          p_provider_event_id: string
          p_restaurant_id: string
          p_subscription_id: string
        }
        Returns: Json
      }
      redeem_loyalty: {
        Args: {
          p_customer: string
          p_order: string
          p_points: number
          p_points_exact?: boolean
          p_points_rate: number
          p_restaurant: string
          p_scope_key: string
          p_stamps: number
        }
        Returns: {
          points_debited: number
          stamps_debited: number
        }[]
      }
      refund_cancelled_loyalty: {
        Args: { p_order: string }
        Returns: {
          refunded: number
          type: string
        }[]
      }
      release_order_checkout_reservation: {
        Args: {
          p_order_id: string
          p_reservation_id: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      release_split_checkout_reservation: {
        Args: { p_restaurant_id: string; p_share_id: string }
        Returns: boolean
      }
      reorder_kitchen_stations: {
        Args: { p_ordered_ids: string[]; p_restaurant_id: string }
        Returns: undefined
      }
      reorder_menu_categories: {
        Args: { p_ordered_ids: string[]; p_restaurant_id: string }
        Returns: undefined
      }
      requeue_domain_outbox: {
        Args: { p_event_id: string; p_operator: string }
        Returns: boolean
      }
      reserve_order_checkout: {
        Args: {
          p_order_id: string
          p_reservation_seconds?: number
          p_restaurant_id: string
          p_table_id: string
        }
        Returns: Json
      }
      reserve_split_checkout: {
        Args: {
          p_reservation_seconds?: number
          p_restaurant_id: string
          p_share_id: string
          p_table_id: string
        }
        Returns: Json
      }
      resolve_active_table_qr_token: {
        Args: { p_token: string }
        Returns: {
          restaurant_id: string
          restaurant_slug: string
          table_id: string
          table_label: string
        }[]
      }
      resolve_payment_reconciliation: {
        Args: { p_event_id: string; p_worker: string }
        Returns: boolean
      }
      rotate_table_qr_token: {
        Args: {
          p_reason?: string
          p_restaurant_id: string
          p_revoked_by?: string
          p_table_id: string
        }
        Returns: string
      }
      set_menu_items_availability: {
        Args: {
          p_is_available: boolean
          p_item_ids: string[]
          p_restaurant_id: string
        }
        Returns: undefined
      }
      settle_payment_share_atomic: {
        Args: {
          p_expected_method: string
          p_restaurant_id: string
          p_settled_by?: string
          p_share_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_table_atomic: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      sweep_fully_paid_idle_sessions: {
        Args: { p_idle_minutes?: number }
        Returns: number
      }
      transition_kitchen_order_atomic: {
        Args: {
          p_order_id: string
          p_restaurant_id: string
          p_station_id: string
          p_target_status: string
        }
        Returns: boolean
      }
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
