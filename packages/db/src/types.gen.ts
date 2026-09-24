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
      accounting_invoice_jobs: {
        Row: {
          add_on_purchase_id: string | null
          amount_minor: number
          attempts: number
          available_at: string
          billing_profile_snapshot: Json
          completed_at: string | null
          created_at: string
          currency: string
          fiscal_document_type: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          provider_contact_ref: string | null
          provider_document_ref: string | null
          provider_invoice_ref: string | null
          provider_name: string | null
          provider_task_ref: string | null
          restaurant_id: string
          status: string
          subscription_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          add_on_purchase_id?: string | null
          amount_minor: number
          attempts?: number
          available_at?: string
          billing_profile_snapshot: Json
          completed_at?: string | null
          created_at?: string
          currency: string
          fiscal_document_type?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          provider_contact_ref?: string | null
          provider_document_ref?: string | null
          provider_invoice_ref?: string | null
          provider_name?: string | null
          provider_task_ref?: string | null
          restaurant_id: string
          status: string
          subscription_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          add_on_purchase_id?: string | null
          amount_minor?: number
          attempts?: number
          available_at?: string
          billing_profile_snapshot?: Json
          completed_at?: string | null
          created_at?: string
          currency?: string
          fiscal_document_type?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          provider_contact_ref?: string | null
          provider_document_ref?: string | null
          provider_invoice_ref?: string | null
          provider_name?: string | null
          provider_task_ref?: string | null
          restaurant_id?: string
          status?: string
          subscription_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_add_on_source_fk"
            columns: ["restaurant_id", "add_on_purchase_id"]
            isOneToOne: false
            referencedRelation: "add_on_purchases"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "accounting_invoice_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoice_jobs_restaurant_id_subscription_invoice_fkey"
            columns: ["restaurant_id", "subscription_invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      accounting_provider_oauth_leases: {
        Row: {
          locked_at: string | null
          locked_by: string | null
          provider: string
          token_version: number
          updated_at: string
        }
        Insert: {
          locked_at?: string | null
          locked_by?: string | null
          provider: string
          token_version?: number
          updated_at?: string
        }
        Update: {
          locked_at?: string | null
          locked_by?: string | null
          provider?: string
          token_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      accounting_review_jobs: {
        Row: {
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          restaurant_id: string
          source_key: string
          status: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          resolved_at?: string | null
          restaurant_id: string
          source_key: string
          status?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          restaurant_id?: string
          source_key?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_review_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_review_jobs_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      add_on_price_versions: {
        Row: {
          active: boolean
          actor_user_id: string | null
          add_on: string
          created_at: string
          net_amount_minor: number
          vat_rate: number
          version: number
        }
        Insert: {
          active?: boolean
          actor_user_id?: string | null
          add_on: string
          created_at?: string
          net_amount_minor: number
          vat_rate: number
          version: number
        }
        Update: {
          active?: boolean
          actor_user_id?: string | null
          add_on?: string
          created_at?: string
          net_amount_minor?: number
          vat_rate?: number
          version?: number
        }
        Relationships: []
      }
      add_on_purchases: {
        Row: {
          actor_user_id: string
          add_on: string
          created_at: string
          currency: string
          id: string
          last_checked_at: string | null
          net_amount_minor: number
          paid_at: string | null
          payment_evidence: Json | null
          payment_page_url: string | null
          price_version: number
          profile: Json
          provider_payment_id: string | null
          provider_token: string | null
          refunded_amount_minor: number
          request_id: string
          restaurant_id: string
          return_context: Json | null
          reversal_evidence: Json | null
          status: string
          terms_version: string
          total_amount_minor: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          actor_user_id: string
          add_on: string
          created_at?: string
          currency?: string
          id?: string
          last_checked_at?: string | null
          net_amount_minor: number
          paid_at?: string | null
          payment_evidence?: Json | null
          payment_page_url?: string | null
          price_version: number
          profile: Json
          provider_payment_id?: string | null
          provider_token?: string | null
          refunded_amount_minor?: number
          request_id: string
          restaurant_id: string
          return_context?: Json | null
          reversal_evidence?: Json | null
          status?: string
          terms_version?: string
          total_amount_minor: number
          updated_at?: string
          vat_rate: number
        }
        Update: {
          actor_user_id?: string
          add_on?: string
          created_at?: string
          currency?: string
          id?: string
          last_checked_at?: string | null
          net_amount_minor?: number
          paid_at?: string | null
          payment_evidence?: Json | null
          payment_page_url?: string | null
          price_version?: number
          profile?: Json
          provider_payment_id?: string | null
          provider_token?: string | null
          refunded_amount_minor?: number
          request_id?: string
          restaurant_id?: string
          return_context?: Json | null
          reversal_evidence?: Json | null
          status?: string
          terms_version?: string
          total_amount_minor?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "add_on_purchases_add_on_price_version_fkey"
            columns: ["add_on", "price_version"]
            isOneToOne: false
            referencedRelation: "add_on_price_versions"
            referencedColumns: ["add_on", "version"]
          },
          {
            foreignKeyName: "add_on_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_transition_log: {
        Row: {
          error_code: string | null
          status: string
          subscription_id: string
          target_plan_ref: string | null
          updated_at: string
        }
        Insert: {
          error_code?: string | null
          status: string
          subscription_id: string
          target_plan_ref?: string | null
          updated_at?: string
        }
        Update: {
          error_code?: string | null
          status?: string
          subscription_id?: string
          target_plan_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_transition_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          billing_address: Json | null
          contact_email: string
          contact_name: string | null
          contact_surname: string | null
          created_at: string
          gsm_number: string | null
          id: string
          identity_number: string | null
          legal_name: string
          profile_completed_at: string | null
          provider: string
          provider_customer_ref: string | null
          restaurant_id: string
          shipping_address: Json | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          contact_email: string
          contact_name?: string | null
          contact_surname?: string | null
          created_at?: string
          gsm_number?: string | null
          id?: string
          identity_number?: string | null
          legal_name: string
          profile_completed_at?: string | null
          provider?: string
          provider_customer_ref?: string | null
          restaurant_id: string
          shipping_address?: Json | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          contact_email?: string
          contact_name?: string | null
          contact_surname?: string | null
          created_at?: string
          gsm_number?: string | null
          id?: string
          identity_number?: string | null
          legal_name?: string
          profile_completed_at?: string | null
          provider?: string
          provider_customer_ref?: string | null
          restaurant_id?: string
          shipping_address?: Json | null
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
      billing_provider_operations: {
        Row: {
          amount_minor: number | null
          attempts: number
          billing_customer_id: string
          billing_interval: string | null
          callback_state_hash: string | null
          change_request_id: string | null
          completed_at: string | null
          created_at: string
          currency: string | null
          due_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          last_error: string | null
          operation_type: string
          period_end: string | null
          period_start: string | null
          provider: string
          provider_checkout_expires_at: string | null
          provider_checkout_ref: string | null
          provider_payment_ref: string | null
          provider_subscription_ref: string | null
          provider_target_plan_ref: string | null
          provider_target_subscription_ref: string | null
          recovery_attempts: number
          recovery_locked_at: string | null
          recovery_locked_by: string | null
          recovery_next_at: string | null
          request_fingerprint: string
          requested_add_ons: string[]
          requested_plan: string | null
          restaurant_id: string
          result_sanitized: Json
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_minor?: number | null
          attempts?: number
          billing_customer_id: string
          billing_interval?: string | null
          callback_state_hash?: string | null
          change_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          due_at?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          last_error?: string | null
          operation_type: string
          period_end?: string | null
          period_start?: string | null
          provider?: string
          provider_checkout_expires_at?: string | null
          provider_checkout_ref?: string | null
          provider_payment_ref?: string | null
          provider_subscription_ref?: string | null
          provider_target_plan_ref?: string | null
          provider_target_subscription_ref?: string | null
          recovery_attempts?: number
          recovery_locked_at?: string | null
          recovery_locked_by?: string | null
          recovery_next_at?: string | null
          request_fingerprint: string
          requested_add_ons?: string[]
          requested_plan?: string | null
          restaurant_id: string
          result_sanitized?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number | null
          attempts?: number
          billing_customer_id?: string
          billing_interval?: string | null
          callback_state_hash?: string | null
          change_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          due_at?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          last_error?: string | null
          operation_type?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string
          provider_checkout_expires_at?: string | null
          provider_checkout_ref?: string | null
          provider_payment_ref?: string | null
          provider_subscription_ref?: string | null
          provider_target_plan_ref?: string | null
          provider_target_subscription_ref?: string | null
          recovery_attempts?: number
          recovery_locked_at?: string | null
          recovery_locked_by?: string | null
          recovery_next_at?: string | null
          request_fingerprint?: string
          requested_add_ons?: string[]
          requested_plan?: string | null
          restaurant_id?: string
          result_sanitized?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_provider_operations_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: true
            referencedRelation: "subscription_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_provider_operations_restaurant_id_billing_customer_fkey"
            columns: ["restaurant_id", "billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "billing_provider_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_provider_operations_restaurant_id_invoice_id_fkey"
            columns: ["restaurant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "billing_provider_operations_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
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
      billing_subscription_provider_refs: {
        Row: {
          created_at: string
          provider: string
          provider_plan_ref: string | null
          provider_subscription_ref: string
          ref_role: string
          restaurant_id: string
          retired_at: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          provider?: string
          provider_plan_ref?: string | null
          provider_subscription_ref: string
          ref_role: string
          restaurant_id: string
          retired_at?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          provider?: string
          provider_plan_ref?: string | null
          provider_subscription_ref?: string
          ref_role?: string
          restaurant_id?: string
          retired_at?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscription_provider_restaurant_id_subscription_i_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          billing_anchor_day: number
          billing_customer_id: string | null
          billing_interval: string
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_at: string | null
          id: string
          intended_plan: string | null
          plan: string
          provider: string | null
          provider_plan_ref: string | null
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
          billing_customer_id?: string | null
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          intended_plan?: string | null
          plan: string
          provider?: string | null
          provider_plan_ref?: string | null
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
          billing_customer_id?: string | null
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          intended_plan?: string | null
          plan?: string
          provider?: string | null
          provider_plan_ref?: string | null
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
      campaign_email_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          provider_message_id: string
          recipient_id: string
          restaurant_id: string
          webhook_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_type: string
          id?: string
          occurred_at: string
          provider_message_id: string
          recipient_id: string
          restaurant_id: string
          webhook_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          provider_message_id?: string
          recipient_id?: string
          restaurant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_email_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_email_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          design: Json
          id: string
          name: string
          restaurant_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          design: Json
          id?: string
          name: string
          restaurant_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          design?: Json
          id?: string
          name?: string
          restaurant_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_email_templates_restaurant_id_fkey"
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
          clicked_at: string | null
          created_at: string
          customer_id: string
          delivery_status: string
          email: string | null
          error: string | null
          id: string
          last_event_at: string | null
          locked_at: string | null
          normalized_email: string | null
          normalized_phone: string | null
          opened_at: string | null
          phone: string | null
          provider_message_id: string | null
          restaurant_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          customer_id: string
          delivery_status?: string
          email?: string | null
          error?: string | null
          id?: string
          last_event_at?: string | null
          locked_at?: string | null
          normalized_email?: string | null
          normalized_phone?: string | null
          opened_at?: string | null
          phone?: string | null
          provider_message_id?: string | null
          restaurant_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_status?: string
          email?: string | null
          error?: string | null
          id?: string
          last_event_at?: string | null
          locked_at?: string | null
          normalized_email?: string | null
          normalized_phone?: string | null
          opened_at?: string | null
          phone?: string | null
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
          content_mode: string
          created_at: string
          created_by: string | null
          custom_segment_id: string | null
          deleted_at: string | null
          email_design: Json | null
          failed_count: number
          id: string
          message_body: string
          name: string
          recipient_count: number
          request_fingerprint: string | null
          request_id: string | null
          restaurant_id: string
          segment_definition: Json
          segment_kind: string
          sent_at: string | null
          sent_count: number
          skipped_consent_count: number
          skipped_count: number
          skipped_duplicate_count: number
          skipped_phone_count: number
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          builtin_segment?: string | null
          channel?: string
          content_mode?: string
          created_at?: string
          created_by?: string | null
          custom_segment_id?: string | null
          deleted_at?: string | null
          email_design?: Json | null
          failed_count?: number
          id?: string
          message_body: string
          name: string
          recipient_count?: number
          request_fingerprint?: string | null
          request_id?: string | null
          restaurant_id: string
          segment_definition?: Json
          segment_kind?: string
          sent_at?: string | null
          sent_count?: number
          skipped_consent_count?: number
          skipped_count?: number
          skipped_duplicate_count?: number
          skipped_phone_count?: number
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          builtin_segment?: string | null
          channel?: string
          content_mode?: string
          created_at?: string
          created_by?: string | null
          custom_segment_id?: string | null
          deleted_at?: string | null
          email_design?: Json | null
          failed_count?: number
          id?: string
          message_body?: string
          name?: string
          recipient_count?: number
          request_fingerprint?: string | null
          request_id?: string | null
          restaurant_id?: string
          segment_definition?: Json
          segment_kind?: string
          sent_at?: string | null
          sent_count?: number
          skipped_consent_count?: number
          skipped_count?: number
          skipped_duplicate_count?: number
          skipped_phone_count?: number
          status?: string
          subject?: string | null
          template_id?: string | null
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
      coupon_categories: {
        Row: {
          category_id: string
          coupon_id: string
        }
        Insert: {
          category_id: string
          coupon_id: string
        }
        Update: {
          category_id?: string
          coupon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_categories_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_items: {
        Row: {
          coupon_id: string
          item_id: string
        }
        Insert: {
          coupon_id: string
          item_id: string
        }
        Update: {
          coupon_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_items_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          code: string
          consumed_at: string
          coupon_id: string
          customer_id: string | null
          discount_amount: number
          id: string
          order_id: string
          release_reason: string | null
          released_at: string | null
          restaurant_id: string
          status: string
        }
        Insert: {
          code: string
          consumed_at?: string
          coupon_id: string
          customer_id?: string | null
          discount_amount: number
          id?: string
          order_id: string
          release_reason?: string | null
          released_at?: string | null
          restaurant_id: string
          status?: string
        }
        Update: {
          code?: string
          consumed_at?: string
          coupon_id?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string
          release_reason?: string | null
          released_at?: string | null
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_write_requests: {
        Row: {
          created_at: string
          input: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Insert: {
          created_at?: string
          input: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Update: {
          created_at?: string
          input?: Json
          request_id?: string
          restaurant_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coupon_write_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          archived_at: string | null
          audience: string
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          enabled: boolean
          ends_at: string | null
          id: string
          marketing_description: string | null
          marketing_label: string | null
          maximum_discount_amount: number | null
          minimum_amount: number
          name: string
          per_customer_limit: number | null
          restaurant_id: string
          scope: string
          stacking_policy: string
          starts_at: string | null
          total_usage_limit: number | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          audience?: string
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          enabled?: boolean
          ends_at?: string | null
          id?: string
          marketing_description?: string | null
          marketing_label?: string | null
          maximum_discount_amount?: number | null
          minimum_amount?: number
          name: string
          per_customer_limit?: number | null
          restaurant_id: string
          scope?: string
          stacking_policy?: string
          starts_at?: string | null
          total_usage_limit?: number | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          audience?: string
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          enabled?: boolean
          ends_at?: string | null
          id?: string
          marketing_description?: string | null
          marketing_label?: string | null
          maximum_discount_amount?: number | null
          minimum_amount?: number
          name?: string
          per_customer_limit?: number | null
          restaurant_id?: string
          scope?: string
          stacking_policy?: string
          starts_at?: string | null
          total_usage_limit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_auth_intents: {
        Row: {
          consumed_at: string | null
          context_hash: string
          created_at: string
          expires_at: string
          flow: string
          nonce_hash: string
        }
        Insert: {
          consumed_at?: string | null
          context_hash: string
          created_at?: string
          expires_at: string
          flow: string
          nonce_hash: string
        }
        Update: {
          consumed_at?: string | null
          context_hash?: string
          created_at?: string
          expires_at?: string
          flow?: string
          nonce_hash?: string
        }
        Relationships: []
      }
      customer_auth_rate_limits: {
        Row: {
          bucket: string
          expires_at: string
          hits: number
          subject_hash: string
          window_started_at: string
        }
        Insert: {
          bucket: string
          expires_at: string
          hits: number
          subject_hash: string
          window_started_at: string
        }
        Update: {
          bucket?: string
          expires_at?: string
          hits?: number
          subject_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      customer_consent_events: {
        Row: {
          action: string
          consent_type: string
          customer_id: string
          id: string
          lawful_basis: string
          occurred_at: string
          policy_version: string
          restaurant_id: string
          source: string
          text_digest: string
        }
        Insert: {
          action: string
          consent_type: string
          customer_id: string
          id?: string
          lawful_basis: string
          occurred_at?: string
          policy_version: string
          restaurant_id: string
          source: string
          text_digest: string
        }
        Update: {
          action?: string
          consent_type?: string
          customer_id?: string
          id?: string
          lawful_basis?: string
          occurred_at?: string
          policy_version?: string
          restaurant_id?: string
          source?: string
          text_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consent_events_restaurant_id_fkey"
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
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          menu_item_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          menu_item_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          menu_item_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_guest_claims: {
        Row: {
          claimed_order_count: number
          created_at: string
          customer_id: string
          device_proof_hash: string
          guest_session_id: string
          id: string
          request_id: string
          restaurant_id: string
          table_session_id: string
        }
        Insert: {
          claimed_order_count?: number
          created_at?: string
          customer_id: string
          device_proof_hash: string
          guest_session_id: string
          id?: string
          request_id: string
          restaurant_id: string
          table_session_id: string
        }
        Update: {
          claimed_order_count?: number
          created_at?: string
          customer_id?: string
          device_proof_hash?: string
          guest_session_id?: string
          id?: string
          request_id?: string
          restaurant_id?: string
          table_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_guest_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_guest_claims_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_guest_claims_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identity_claims: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          kind: string
          normalized_value: string
          source: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          normalized_value: string
          source: string
          updated_at?: string
          verified_at: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          normalized_value?: string
          source?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_identity_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identity_merge_audit: {
        Row: {
          created_at: string
          id: string
          merged_consents: number
          merged_customer_id: string
          moved_ledger_rows: number
          moved_orders: number
          moved_payment_shares: number
          reason: string
          survivor_customer_id: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          merged_consents: number
          merged_customer_id: string
          moved_ledger_rows: number
          moved_orders: number
          moved_payment_shares: number
          reason: string
          survivor_customer_id: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          merged_consents?: number
          merged_customer_id?: string
          moved_ledger_rows?: number
          moved_orders?: number
          moved_payment_shares?: number
          reason?: string
          survivor_customer_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_identity_merge_audit_merged_customer_id_fkey"
            columns: ["merged_customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_merge_audit_survivor_customer_id_fkey"
            columns: ["survivor_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_privacy_requests: {
        Row: {
          completed_at: string | null
          customer_id: string | null
          customer_reference_digest: string
          id: string
          idempotency_key: string
          metadata: Json
          payload_digest: string | null
          request_type: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          customer_id?: string | null
          customer_reference_digest: string
          id: string
          idempotency_key: string
          metadata?: Json
          payload_digest?: string | null
          request_type: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          customer_id?: string | null
          customer_reference_digest?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          payload_digest?: string | null
          request_type?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_privacy_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          merged_at: string | null
          merged_into_customer_id: string | null
          name: string | null
          phone: string | null
          verified_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          merged_at?: string | null
          merged_into_customer_id?: string | null
          name?: string | null
          phone?: string | null
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          merged_at?: string | null
          merged_into_customer_id?: string | null
          name?: string | null
          phone?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey"
            columns: ["merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_auth_rate_limits: {
        Row: {
          action: string
          attempts: number
          subject_hash: string
          window_started_at: string
        }
        Insert: {
          action: string
          attempts?: number
          subject_hash: string
          window_started_at?: string
        }
        Update: {
          action?: string
          attempts?: number
          subject_hash?: string
          window_started_at?: string
        }
        Relationships: []
      }
      dashboard_device_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          country: string | null
          created_at: string
          device_hash: string
          expires_at: string
          id: string
          ip_hash: string | null
          sent_at: string | null
          session_id: string
          user_agent_hash: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          country?: string | null
          created_at?: string
          device_hash: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          sent_at?: string | null
          session_id: string
          user_agent_hash: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          country?: string | null
          created_at?: string
          device_hash?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          sent_at?: string | null
          session_id?: string
          user_agent_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_media_uploads: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          kind: string
          metadata: Json
          path: string
          restaurant_id: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id: string
          kind: string
          metadata: Json
          path: string
          restaurant_id: string
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          metadata?: Json
          path?: string
          restaurant_id?: string
          result?: Json | null
          status?: string
          user_id?: string
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
      dashboard_recovery_email_intents: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          otp_digest: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          otp_digest: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          otp_digest?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_security_accounts: {
        Row: {
          enrolled_at: string
          user_id: string
        }
        Insert: {
          enrolled_at?: string
          user_id: string
        }
        Update: {
          enrolled_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_trusted_devices: {
        Row: {
          country: string | null
          created_at: string
          expires_at: string
          ip_hash: string | null
          revoked_at: string | null
          token_hash: string
          user_agent_hash: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          expires_at: string
          ip_hash?: string | null
          revoked_at?: string | null
          token_hash: string
          user_agent_hash: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          expires_at?: string
          ip_hash?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_agent_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_verified_sessions: {
        Row: {
          country: string | null
          device_hash: string
          expires_at: string
          ip_hash: string | null
          revoked_at: string | null
          session_id: string
          user_agent_hash: string
          user_id: string
          verified_at: string
        }
        Insert: {
          country?: string | null
          device_hash: string
          expires_at: string
          ip_hash?: string | null
          revoked_at?: string | null
          session_id: string
          user_agent_hash: string
          user_id: string
          verified_at?: string
        }
        Update: {
          country?: string | null
          device_hash?: string
          expires_at?: string
          ip_hash?: string | null
          revoked_at?: string | null
          session_id?: string
          user_agent_hash?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
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
          locked_at: string | null
          locked_by: string | null
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
          locked_at?: string | null
          locked_by?: string | null
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
          locked_at?: string | null
          locked_by?: string | null
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
      inventory_counts: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          lines: Json
          restaurant_id: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          lines: Json
          restaurant_id: string
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          lines?: Json
          restaurant_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "inventory_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_documents: {
        Row: {
          actor_id: string | null
          actor_label: string
          created_at: string
          id: string
          kind: string
          order_id: string | null
          payload: Json
          reason: string
          request_id: string
          restaurant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          id?: string
          kind: string
          order_id?: string | null
          payload: Json
          reason?: string
          request_id: string
          restaurant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          payload?: Json
          reason?: string
          request_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          archived: boolean
          category: string
          conversions: Json
          cost: number | null
          id: string
          kind: string
          name: string
          quantity: number
          restaurant_id: string
          shelf: string
          threshold: number
          unit: string
          version: number
        }
        Insert: {
          archived?: boolean
          category?: string
          conversions?: Json
          cost?: number | null
          id?: string
          kind: string
          name: string
          quantity?: number
          restaurant_id: string
          shelf?: string
          threshold?: number
          unit: string
          version?: number
        }
        Update: {
          archived?: boolean
          category?: string
          conversions?: Json
          cost?: number | null
          id?: string
          kind?: string
          name?: string
          quantity?: number
          restaurant_id?: string
          shelf?: string
          threshold?: number
          unit?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          cost: number | null
          created_at: string
          document_id: string
          id: string
          item_id: string
          quantity: number
          restaurant_id: string
          reversal_of: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          document_id: string
          id?: string
          item_id: string
          quantity: number
          restaurant_id: string
          reversal_of?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          document_id?: string
          id?: string
          item_id?: string
          quantity?: number
          restaurant_id?: string
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_restaurant_id_document_id_fkey"
            columns: ["restaurant_id", "document_id"]
            isOneToOne: false
            referencedRelation: "inventory_documents"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_restaurant_id_item_id_fkey"
            columns: ["restaurant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_order_lines: {
        Row: {
          cancelled: boolean
          consumed: boolean
          costs: Json
          line_id: string
          order_id: string
          prepared: boolean
          quantity: number
          recipe_id: string | null
          requirements: Json
          restaurant_id: string
          returned: Json
        }
        Insert: {
          cancelled?: boolean
          consumed?: boolean
          costs?: Json
          line_id: string
          order_id: string
          prepared?: boolean
          quantity: number
          recipe_id?: string | null
          requirements: Json
          restaurant_id: string
          returned?: Json
        }
        Update: {
          cancelled?: boolean
          consumed?: boolean
          costs?: Json
          line_id?: string
          order_id?: string
          prepared?: boolean
          quantity?: number
          recipe_id?: string | null
          requirements?: Json
          restaurant_id?: string
          returned?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inventory_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_order_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "inventory_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_order_lines_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_recipes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          lines: Json
          menu_item_id: string | null
          mode: string
          output_item_id: string | null
          output_quantity: number
          restaurant_id: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          lines: Json
          menu_item_id?: string | null
          mode: string
          output_item_id?: string | null
          output_quantity?: number
          restaurant_id: string
          version: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          lines?: Json
          menu_item_id?: string | null
          mode?: string
          output_item_id?: string | null
          output_quantity?: number
          restaurant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_recipes_restaurant_id_output_item_id_fkey"
            columns: ["restaurant_id", "output_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      inventory_requests: {
        Row: {
          payload: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Insert: {
          payload: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Update: {
          payload?: Json
          request_id?: string
          restaurant_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inventory_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_settings: {
        Row: {
          enabled: boolean
          restaurant_id: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          restaurant_id: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          restaurant_id?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
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
      legal_document_acceptances: {
        Row: {
          created_at: string
          document_context: Json
          document_type: string
          document_version: string
          evidence_key: string
          id: string
          ip_hash: string | null
          occurred_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_context?: Json
          document_type: string
          document_version: string
          evidence_key?: string
          id?: string
          ip_hash?: string | null
          occurred_at: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_context?: Json
          document_type?: string
          document_version?: string
          evidence_key?: string
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_id: string
          delta: number
          direction: string
          granted_by: string | null
          id: string
          manual_credit_request_id: string | null
          order_id: string | null
          reason: string
          refund_id: string | null
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
          manual_credit_request_id?: string | null
          order_id?: string | null
          reason: string
          refund_id?: string | null
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
          manual_credit_request_id?: string | null
          order_id?: string | null
          reason?: string
          refund_id?: string | null
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
            foreignKeyName: "loyalty_transactions_manual_credit_request_id_fkey"
            columns: ["manual_credit_request_id"]
            isOneToOne: false
            referencedRelation: "manual_store_credit_requests"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refunds"
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
      manual_store_credit_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string
          granted_by: string | null
          loyalty_transaction_id: string | null
          note: string | null
          points: number
          request_id: string
          restaurant_id: string
          scope_key: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id: string
          granted_by?: string | null
          loyalty_transaction_id?: string | null
          note?: string | null
          points: number
          request_id: string
          restaurant_id: string
          scope_key: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          granted_by?: string | null
          loyalty_transaction_id?: string | null
          note?: string | null
          points?: number
          request_id?: string
          restaurant_id?: string
          scope_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_store_credit_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_store_credit_requests_loyalty_transaction_id_fkey"
            columns: ["loyalty_transaction_id"]
            isOneToOne: false
            referencedRelation: "loyalty_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_store_credit_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_asset_objects: {
        Row: {
          asset_id: string
          bucket: string
          bytes: number
          path: string
          restaurant_id: string
          role: string
          url: string
        }
        Insert: {
          asset_id: string
          bucket: string
          bytes: number
          path: string
          restaurant_id: string
          role: string
          url?: string
        }
        Update: {
          asset_id?: string
          bucket?: string
          bytes?: number
          path?: string
          restaurant_id?: string
          role?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_objects_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_asset_objects_restaurant_id_asset_id_fkey"
            columns: ["restaurant_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      media_asset_references: {
        Row: {
          asset_id: string
          label: string
          restaurant_id: string
          target_id: string
          target_table: string
        }
        Insert: {
          asset_id: string
          label: string
          restaurant_id: string
          target_id: string
          target_table: string
        }
        Update: {
          asset_id?: string
          label?: string
          restaurant_id?: string
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_references_restaurant_id_asset_id_fkey"
            columns: ["restaurant_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt: string
          created_at: string
          created_by: string | null
          duration: number | null
          hash: string | null
          height: number | null
          id: string
          mime: string
          name: string
          restaurant_id: string
          status: string
          version: number
          width: number | null
        }
        Insert: {
          alt?: string
          created_at?: string
          created_by?: string | null
          duration?: number | null
          hash?: string | null
          height?: number | null
          id: string
          mime: string
          name: string
          restaurant_id: string
          status?: string
          version?: number
          width?: number | null
        }
        Update: {
          alt?: string
          created_at?: string
          created_by?: string | null
          duration?: number | null
          hash?: string | null
          height?: number | null
          id?: string
          mime?: string
          name?: string
          restaurant_id?: string
          status?: string
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_cleanup_jobs: {
        Row: {
          asset_id: string | null
          bucket: string
          bytes: number
          created_at: string
          id: number
          path: string
          restaurant_id: string
          status: string
        }
        Insert: {
          asset_id?: string | null
          bucket: string
          bytes?: number
          created_at?: string
          id?: never
          path: string
          restaurant_id: string
          status?: string
        }
        Update: {
          asset_id?: string | null
          bucket?: string
          bytes?: number
          created_at?: string
          id?: never
          path?: string
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_cleanup_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_cleanup_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_operation_events: {
        Row: {
          actor_id: string
          context: string
          id: number
          operation: string
          recorded_at: string
          restaurant_id: string
          target_id: string | null
        }
        Insert: {
          actor_id: string
          context: string
          id?: never
          operation: string
          recorded_at?: string
          restaurant_id: string
          target_id?: string | null
        }
        Update: {
          actor_id?: string
          context?: string
          id?: never
          operation?: string
          recorded_at?: string
          restaurant_id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_operation_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_storage_usage: {
        Row: {
          initialized: boolean
          reserved: number
          restaurant_id: string
          used: number
        }
        Insert: {
          initialized?: boolean
          reserved?: number
          restaurant_id: string
          used?: number
        }
        Update: {
          initialized?: boolean
          reserved?: number
          restaurant_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_storage_usage_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_upload_sessions: {
        Row: {
          actor_id: string
          asset_id: string
          created_at: string
          expires_at: string
          id: string
          lease_until: string | null
          metadata: Json
          reserved: number
          restaurant_id: string
          result_id: string | null
          status: string
          token: string | null
        }
        Insert: {
          actor_id: string
          asset_id: string
          created_at?: string
          expires_at?: string
          id: string
          lease_until?: string | null
          metadata: Json
          reserved: number
          restaurant_id: string
          result_id?: string | null
          status?: string
          token?: string | null
        }
        Update: {
          actor_id?: string
          asset_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          lease_until?: string | null
          metadata?: Json
          reserved?: number
          restaurant_id?: string
          result_id?: string | null
          status?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_upload_sessions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_upload_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_bulk_operations: {
        Row: {
          actor_email: string | null
          actor_id: string
          actor_label: string
          actor_role: string | null
          changes: Json
          created_at: string
          id: string
          request_id: string
          request_payload: Json
          restaurant_id: string
          undo_of: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id: string
          actor_label: string
          actor_role?: string | null
          changes: Json
          created_at?: string
          id?: string
          request_id: string
          request_payload: Json
          restaurant_id: string
          undo_of?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string
          actor_label?: string
          actor_role?: string | null
          changes?: Json
          created_at?: string
          id?: string
          request_id?: string
          request_payload?: Json
          restaurant_id?: string
          undo_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_bulk_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_bulk_operations_undo_of_fkey"
            columns: ["undo_of"]
            isOneToOne: true
            referencedRelation: "menu_bulk_operations"
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
      menu_invalidations: {
        Row: {
          restaurant_id: string
          source: string
          updated_at: string
          version: number
        }
        Insert: {
          restaurant_id: string
          source: string
          updated_at?: string
          version?: number
        }
        Update: {
          restaurant_id?: string
          source?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_invalidations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_recommendations: {
        Row: {
          created_at: string
          id: string
          position: number
          recommended_item_id: string
          restaurant_id: string
          source_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          recommended_item_id: string
          restaurant_id: string
          source_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          recommended_item_id?: string
          restaurant_id?: string
          source_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_recommendations_recommended_item_id_fkey"
            columns: ["recommended_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_recommendations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_recommendations_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
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
      menu_translation_attempts: {
        Row: {
          cost_microdollars: number | null
          created_at: string
          job_id: string
          lease: string
          period: string
          reserved_microdollars: number
        }
        Insert: {
          cost_microdollars?: number | null
          created_at?: string
          job_id: string
          lease: string
          period: string
          reserved_microdollars?: number
        }
        Update: {
          cost_microdollars?: number | null
          created_at?: string
          job_id?: string
          lease?: string
          period?: string
          reserved_microdollars?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "menu_translation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_fields: {
        Row: {
          active: boolean
          draft: string | null
          draft_source_version: number | null
          key: string
          label: string
          published: string | null
          published_source_version: number | null
          restaurant_id: string
          source: string
          source_version: number
          version: number
        }
        Insert: {
          active?: boolean
          draft?: string | null
          draft_source_version?: number | null
          key: string
          label: string
          published?: string | null
          published_source_version?: number | null
          restaurant_id: string
          source: string
          source_version?: number
          version?: number
        }
        Update: {
          active?: boolean
          draft?: string | null
          draft_source_version?: number | null
          key?: string
          label?: string
          published?: string | null
          published_source_version?: number | null
          restaurant_id?: string
          source?: string
          source_version?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_fields_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field_key: string
          id: number
          restaurant_id: string
          source: string
          source_version: number
          text: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field_key: string
          id?: never
          restaurant_id: string
          source: string
          source_version: number
          text: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field_key?: string
          id?: never
          restaurant_id?: string
          source?: string
          source_version?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_jobs: {
        Row: {
          attempts: number
          available_at: string
          characters: number
          created_at: string
          error: string | null
          fields: Json
          glossary: Json
          id: string
          input_tokens: number | null
          lease: string | null
          lease_until: string | null
          output_tokens: number | null
          period: string
          restaurant_id: string
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          characters: number
          created_at?: string
          error?: string | null
          fields: Json
          glossary: Json
          id?: string
          input_tokens?: number | null
          lease?: string | null
          lease_until?: string | null
          output_tokens?: number | null
          period: string
          restaurant_id: string
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          characters?: number
          created_at?: string
          error?: string | null
          fields?: Json
          glossary?: Json
          id?: string
          input_tokens?: number | null
          lease?: string | null
          lease_until?: string | null
          output_tokens?: number | null
          period?: string
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_provider_spend: {
        Row: {
          period: string
          reserved_microdollars: number
          spent_microdollars: number
        }
        Insert: {
          period: string
          reserved_microdollars?: number
          spent_microdollars?: number
        }
        Update: {
          period?: string
          reserved_microdollars?: number
          spent_microdollars?: number
        }
        Relationships: []
      }
      menu_translation_requests: {
        Row: {
          actor_id: string
          input: Json
          request_id: string
          restaurant_id: string
        }
        Insert: {
          actor_id: string
          input: Json
          request_id: string
          restaurant_id: string
        }
        Update: {
          actor_id?: string
          input?: Json
          request_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_settings: {
        Row: {
          enabled: boolean
          glossary: Json
          initialized: boolean
          restaurant_id: string
          revision: number
        }
        Insert: {
          enabled?: boolean
          glossary?: Json
          initialized?: boolean
          restaurant_id: string
          revision?: number
        }
        Update: {
          enabled?: boolean
          glossary?: Json
          initialized?: boolean
          restaurant_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translation_usage: {
        Row: {
          locale: string
          period: string
          reserved: number
          restaurant_id: string
          used: number
        }
        Insert: {
          locale?: string
          period: string
          reserved?: number
          restaurant_id: string
          used?: number
        }
        Update: {
          locale?: string
          period?: string
          reserved?: number
          restaurant_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_translation_usage_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
          provider_delivery_status: string | null
          provider_event_at: string | null
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
          provider_delivery_status?: string | null
          provider_event_at?: string | null
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
          provider_delivery_status?: string | null
          provider_event_at?: string | null
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
      notification_delivery_provider_events: {
        Row: {
          created_at: string
          event_type: string
          notification_delivery_id: string
          occurred_at: string
          provider_message_id: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          notification_delivery_id: string
          occurred_at: string
          provider_message_id: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          notification_delivery_id?: string
          occurred_at?: string
          provider_message_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_provider_ev_notification_delivery_id_fkey"
            columns: ["notification_delivery_id"]
            isOneToOne: false
            referencedRelation: "notification_deliveries"
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
          provider_currency: string | null
          provider_paid_price: number | null
          provider_payment_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          order_id: string
          provider_currency?: string | null
          provider_paid_price?: number | null
          provider_payment_id?: string | null
          token: string
        }
        Update: {
          created_at?: string
          order_id?: string
          provider_currency?: string | null
          provider_paid_price?: number | null
          provider_payment_id?: string | null
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
      order_refunds: {
        Row: {
          actor_user_id: string | null
          amount: number
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          kind: string
          order_id: string
          payment_method: string
          provider: string | null
          provider_payment_id: string | null
          provider_refund_ref: string | null
          reason: string | null
          refunded_at: string | null
          requested_at: string
          restaurant_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          kind: string
          order_id: string
          payment_method: string
          provider?: string | null
          provider_payment_id?: string | null
          provider_refund_ref?: string | null
          reason?: string | null
          refunded_at?: string | null
          requested_at?: string
          restaurant_id: string
          source: string
          status: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          order_id?: string
          payment_method?: string
          provider?: string | null
          provider_payment_id?: string | null
          provider_refund_ref?: string | null
          reason?: string | null
          refunded_at?: string | null
          requested_at?: string
          restaurant_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_order_tenant_fkey"
            columns: ["order_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "order_refunds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          source: string
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
          source?: string
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
          source?: string
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
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          permissions: Json
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          permissions?: Json
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_restaurants: {
        Row: {
          created_at: string
          organization_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_restaurants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pano_invalidations: {
        Row: {
          restaurant_id: string
          source: string
          updated_at: string
          version: number
        }
        Insert: {
          restaurant_id: string
          source: string
          updated_at?: string
          version?: number
        }
        Update: {
          restaurant_id?: string
          source?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pano_invalidations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credential_rotation_audit: {
        Row: {
          actor_user_id: string
          created_at: string
          from_key_version: string | null
          id: number
          operation: string
          request_id: string
          restaurant_id: string
          to_key_version: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          from_key_version?: string | null
          id?: never
          operation: string
          request_id: string
          restaurant_id: string
          to_key_version?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          from_key_version?: string | null
          id?: never
          operation?: string
          request_id?: string
          restaurant_id?: string
          to_key_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_credential_rotation_audit_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credential_vaults: {
        Row: {
          api_key_last4: string
          created_at: string
          encrypted_payload: Json
          key_version: string
          mode: string
          provider: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          api_key_last4: string
          created_at?: string
          encrypted_payload: Json
          key_version: string
          mode?: string
          provider?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          api_key_last4?: string
          created_at?: string
          encrypted_payload?: Json
          key_version?: string
          mode?: string
          provider?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_credential_vaults_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credential_write_operations: {
        Row: {
          created_at: string
          operation: string
          outcome: Json
          payload_fingerprint: string
          request_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          operation: string
          outcome: Json
          payload_fingerprint: string
          request_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          operation?: string
          outcome?: Json
          payload_fingerprint?: string
          request_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_credential_write_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          request_fingerprint: string | null
          request_id: string | null
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
          request_fingerprint?: string | null
          request_id?: string | null
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
          request_fingerprint?: string | null
          request_id?: string | null
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
      platform_account_unlocks: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          previous_banned_until: string | null
          reason: string
          request_id: string
          restaurant_id: string
          status: string
          user_id: string
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          previous_banned_until?: string | null
          reason: string
          request_id: string
          restaurant_id: string
          status: string
          user_id: string
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          previous_banned_until?: string | null
          reason?: string
          request_id?: string
          restaurant_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_account_unlocks_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_account_unlocks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_audit_log: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          reason: string
          request_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason: string
          request_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason?: string
          request_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_admin_impersonation_sessions: {
        Row: {
          actor_role: string
          actor_user_id: string
          created_at: string
          end_request_id: string | null
          ended_at: string | null
          expires_at: string
          id: string
          reason: string
          restaurant_id: string
          start_request_id: string
          started_at: string
        }
        Insert: {
          actor_role: string
          actor_user_id: string
          created_at?: string
          end_request_id?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          reason: string
          restaurant_id: string
          start_request_id: string
          started_at?: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string
          created_at?: string
          end_request_id?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason?: string
          restaurant_id?: string
          start_request_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_impersonation_sessions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_admin_impersonation_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_users: {
        Row: {
          activated_at: string | null
          created_at: string
          display_name: string | null
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          invited_by?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_error_events: {
        Row: {
          app: string
          created_at: string
          fingerprint: string
          id: number
          occurred_at: string
          public_code: string
          reference_id: string | null
          restaurant_id: string | null
          severity: string
          source: string
        }
        Insert: {
          app: string
          created_at?: string
          fingerprint: string
          id?: never
          occurred_at?: string
          public_code: string
          reference_id?: string | null
          restaurant_id?: string | null
          severity: string
          source: string
        }
        Update: {
          app?: string
          created_at?: string
          fingerprint?: string
          id?: never
          occurred_at?: string
          public_code?: string
          reference_id?: string | null
          restaurant_id?: string | null
          severity?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_error_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_tenant_privacy_operations: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          operation_type: string
          reason: string
          request_id: string
          requested_by: string
          restaurant_id: string
          result_summary: Json
          status: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          operation_type: string
          reason: string
          request_id: string
          requested_by: string
          restaurant_id: string
          result_summary: Json
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          operation_type?: string
          reason?: string
          request_id?: string
          requested_by?: string
          restaurant_id?: string
          result_summary?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_tenant_privacy_operations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_tenant_privacy_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
      restaurant_add_on_ownership: {
        Row: {
          add_on: string
          granted_at: string
          legacy_invoice_id: string | null
          purchase_id: string | null
          restaurant_id: string
          revoked_at: string | null
        }
        Insert: {
          add_on: string
          granted_at?: string
          legacy_invoice_id?: string | null
          purchase_id?: string | null
          restaurant_id: string
          revoked_at?: string | null
        }
        Update: {
          add_on?: string
          granted_at?: string
          legacy_invoice_id?: string | null
          purchase_id?: string | null
          restaurant_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_add_on_ownership_legacy_invoice_id_fkey"
            columns: ["legacy_invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_add_on_ownership_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "add_on_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_add_on_ownership_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_first_paid_activations: {
        Row: {
          activated_at: string
          recorded_at: string
          restaurant_id: string
          subscription_invoice_id: string
        }
        Insert: {
          activated_at: string
          recorded_at?: string
          restaurant_id: string
          subscription_invoice_id: string
        }
        Update: {
          activated_at?: string
          recorded_at?: string
          restaurant_id?: string
          subscription_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_first_paid_activat_restaurant_id_subscription_i_fkey"
            columns: ["restaurant_id", "subscription_invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "restaurant_first_paid_activations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_integration_health: {
        Row: {
          error_code: string | null
          last_checked_at: string | null
          last_success_at: string | null
          mode: string
          provider: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          error_code?: string | null
          last_checked_at?: string | null
          last_success_at?: string | null
          mode: string
          provider: string
          restaurant_id: string
          status: string
          updated_at?: string
        }
        Update: {
          error_code?: string | null
          last_checked_at?: string | null
          last_success_at?: string | null
          mode?: string
          provider?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_integration_health_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
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
      restaurant_onboarding_operations: {
        Row: {
          created_at: string
          operation: string
          owner_user_id: string
          request_id: string
          request_payload: Json
          restaurant_id: string | null
          result: Json
        }
        Insert: {
          created_at?: string
          operation: string
          owner_user_id: string
          request_id: string
          request_payload: Json
          restaurant_id?: string | null
          result: Json
        }
        Update: {
          created_at?: string
          operation?: string
          owner_user_id?: string
          request_id?: string
          request_payload?: Json
          restaurant_id?: string | null
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_onboarding_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_onboarding_states: {
        Row: {
          checklist_dismissed_at: string | null
          completed_at: string | null
          completed_steps: string[]
          current_step: string
          menu_draft: Json | null
          menu_entry_method: string | null
          owner_user_id: string
          restaurant_id: string
          revision: number
          started_at: string
          status: string
          target_billing_interval: string
          target_plan: string | null
          updated_at: string
        }
        Insert: {
          checklist_dismissed_at?: string | null
          completed_at?: string | null
          completed_steps?: string[]
          current_step?: string
          menu_draft?: Json | null
          menu_entry_method?: string | null
          owner_user_id: string
          restaurant_id: string
          revision?: number
          started_at?: string
          status?: string
          target_billing_interval?: string
          target_plan?: string | null
          updated_at?: string
        }
        Update: {
          checklist_dismissed_at?: string | null
          completed_at?: string | null
          completed_steps?: string[]
          current_step?: string
          menu_draft?: Json | null
          menu_entry_method?: string | null
          owner_user_id?: string
          restaurant_id?: string
          revision?: number
          started_at?: string
          status?: string
          target_billing_interval?: string
          target_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_onboarding_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings_patch_operations: {
        Row: {
          created_at: string
          expected_states: Json
          patch: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Insert: {
          created_at?: string
          expected_states: Json
          patch: Json
          request_id: string
          restaurant_id: string
          result: Json
        }
        Update: {
          created_at?: string
          expected_states?: Json
          patch?: Json
          request_id?: string
          restaurant_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_patch_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings_revisions: {
        Row: {
          restaurant_id: string
          revision: number
          source: string
          updated_at: string
        }
        Insert: {
          restaurant_id: string
          revision?: number
          source?: string
          updated_at?: string
        }
        Update: {
          restaurant_id?: string
          revision?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_revisions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_subscription_add_ons: {
        Row: {
          activated_at: string
          add_on: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          add_on: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          add_on?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          restaurant_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_subscription_add_o_restaurant_id_subscription_i_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "restaurant_subscription_add_ons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_subscription_add_ons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_timezone_requests: {
        Row: {
          actor_user_id: string
          created_at: string
          expected_timezone: string
          request_id: string
          requested_timezone: string
          restaurant_id: string
          result: Json
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          expected_timezone: string
          request_id: string
          requested_timezone: string
          restaurant_id: string
          result: Json
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          expected_timezone?: string
          request_id?: string
          requested_timezone?: string
          restaurant_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_timezone_requests_restaurant_id_fkey"
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
          qr_style_revision: number
          settings: Json
          slug: string
          table_layout_initialized_at: string | null
          table_layout_revision: number
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
          qr_style_revision?: number
          settings?: Json
          slug: string
          table_layout_initialized_at?: string | null
          table_layout_revision?: number
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
          qr_style_revision?: number
          settings?: Json
          slug?: string
          table_layout_initialized_at?: string | null
          table_layout_revision?: number
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
      subscription_add_on_catalog: {
        Row: {
          active: boolean
          add_on: string
          billing_interval: string
          created_at: string
          net_amount_minor: number
          plan: string
          provider_gross_amount_minor: number
          provider_plan_ref: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          add_on: string
          billing_interval: string
          created_at?: string
          net_amount_minor: number
          plan: string
          provider_gross_amount_minor: number
          provider_plan_ref: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          add_on?: string
          billing_interval?: string
          created_at?: string
          net_amount_minor?: number
          plan?: string
          provider_gross_amount_minor?: number
          provider_plan_ref?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_cancellation_provider_targets: {
        Row: {
          applied_at: string | null
          attempts: number
          cancellation_request_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string
          provider: string
          provider_cancelled_at: string | null
          provider_operation_id: string | null
          provider_subscription_ref: string
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          attempts?: number
          cancellation_request_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string
          provider?: string
          provider_cancelled_at?: string | null
          provider_operation_id?: string | null
          provider_subscription_ref: string
          restaurant_id: string
          status: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          attempts?: number
          cancellation_request_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string
          provider?: string
          provider_cancelled_at?: string | null
          provider_operation_id?: string | null
          provider_subscription_ref?: string
          restaurant_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellation_pro_restaurant_id_subscription_i_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "subscription_cancellation_provider_cancellation_request_id_fkey"
            columns: ["cancellation_request_id"]
            isOneToOne: false
            referencedRelation: "subscription_cancellation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_provider_t_provider_operation_id_fkey"
            columns: ["provider_operation_id"]
            isOneToOne: true
            referencedRelation: "billing_provider_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_provider_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cancellation_requests: {
        Row: {
          applied_at: string | null
          attempts: number
          created_at: string
          effective_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          mode: string
          next_attempt_at: string
          provider: string
          provider_cancel_at: string
          provider_cancelled_at: string | null
          provider_operation_id: string | null
          provider_subscription_ref: string
          request_fingerprint: string
          requested_by: string
          restaurant_id: string
          scheduled_at: string
          source_refund_id: string | null
          status: string
          subscription_id: string
          superseded_at: string | null
          superseded_by_request_id: string | null
          updated_at: string
          withdrawal_idempotency_key: string | null
          withdrawal_request_fingerprint: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          applied_at?: string | null
          attempts?: number
          created_at?: string
          effective_at: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mode?: string
          next_attempt_at?: string
          provider?: string
          provider_cancel_at: string
          provider_cancelled_at?: string | null
          provider_operation_id?: string | null
          provider_subscription_ref: string
          request_fingerprint: string
          requested_by: string
          restaurant_id: string
          scheduled_at: string
          source_refund_id?: string | null
          status: string
          subscription_id: string
          superseded_at?: string | null
          superseded_by_request_id?: string | null
          updated_at?: string
          withdrawal_idempotency_key?: string | null
          withdrawal_request_fingerprint?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          applied_at?: string | null
          attempts?: number
          created_at?: string
          effective_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mode?: string
          next_attempt_at?: string
          provider?: string
          provider_cancel_at?: string
          provider_cancelled_at?: string | null
          provider_operation_id?: string | null
          provider_subscription_ref?: string
          request_fingerprint?: string
          requested_by?: string
          restaurant_id?: string
          scheduled_at?: string
          source_refund_id?: string | null
          status?: string
          subscription_id?: string
          superseded_at?: string | null
          superseded_by_request_id?: string | null
          updated_at?: string
          withdrawal_idempotency_key?: string | null
          withdrawal_request_fingerprint?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellation_req_restaurant_id_subscription_i_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "subscription_cancellation_requests_provider_operation_id_fkey"
            columns: ["provider_operation_id"]
            isOneToOne: true
            referencedRelation: "billing_provider_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_requests_source_refund_fk"
            columns: ["source_refund_id"]
            isOneToOne: true
            referencedRelation: "subscription_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_requests_superseded_by_fk"
            columns: ["superseded_by_request_id"]
            isOneToOne: false
            referencedRelation: "subscription_cancellation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_change_requests: {
        Row: {
          applied_at: string | null
          cancelled_at: string | null
          change_kind: string
          created_at: string
          effective_at: string
          effective_policy: string
          from_add_ons: string[]
          from_billing_interval: string
          from_plan: string
          id: string
          idempotency_key: string
          last_error: string | null
          paid_at: string | null
          paid_invoice_id: string | null
          provider: string
          provider_operation_id: string | null
          provider_parent_subscription_ref: string
          provider_result_sanitized: Json
          provider_target_plan_ref: string
          provider_target_subscription_ref: string | null
          request_fingerprint: string
          requested_by: string
          restaurant_id: string
          scheduled_at: string | null
          status: string
          subscription_id: string
          to_add_ons: string[]
          to_billing_interval: string
          to_plan: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          cancelled_at?: string | null
          change_kind: string
          created_at?: string
          effective_at: string
          effective_policy: string
          from_add_ons?: string[]
          from_billing_interval: string
          from_plan: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          paid_at?: string | null
          paid_invoice_id?: string | null
          provider?: string
          provider_operation_id?: string | null
          provider_parent_subscription_ref: string
          provider_result_sanitized?: Json
          provider_target_plan_ref: string
          provider_target_subscription_ref?: string | null
          request_fingerprint: string
          requested_by: string
          restaurant_id: string
          scheduled_at?: string | null
          status: string
          subscription_id: string
          to_add_ons?: string[]
          to_billing_interval: string
          to_plan: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          cancelled_at?: string | null
          change_kind?: string
          created_at?: string
          effective_at?: string
          effective_policy?: string
          from_add_ons?: string[]
          from_billing_interval?: string
          from_plan?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          paid_at?: string | null
          paid_invoice_id?: string | null
          provider?: string
          provider_operation_id?: string | null
          provider_parent_subscription_ref?: string
          provider_result_sanitized?: Json
          provider_target_plan_ref?: string
          provider_target_subscription_ref?: string | null
          request_fingerprint?: string
          requested_by?: string
          restaurant_id?: string
          scheduled_at?: string | null
          status?: string
          subscription_id?: string
          to_add_ons?: string[]
          to_billing_interval?: string
          to_plan?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_change_requests_paid_invoice_fk"
            columns: ["restaurant_id", "paid_invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "subscription_change_requests_provider_operation_fk"
            columns: ["provider_operation_id"]
            isOneToOne: true
            referencedRelation: "billing_provider_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_change_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_change_requests_restaurant_id_subscription_id_fkey"
            columns: ["restaurant_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          add_ons: string[]
          amount_due_minor: number
          amount_paid_minor: number
          billing_interval: string
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
          add_ons?: string[]
          amount_due_minor: number
          amount_paid_minor?: number
          billing_interval?: string
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
          add_ons?: string[]
          amount_due_minor?: number
          amount_paid_minor?: number
          billing_interval?: string
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
          provider_payment_id: string | null
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
          provider_payment_id?: string | null
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
          provider_payment_id?: string | null
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
      subscription_refunds: {
        Row: {
          access_action: string
          amount_minor: number
          cancellation_request_id: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          kind: string
          payment_attempt_id: string
          provider: string
          provider_operation_id: string
          provider_payment_id: string
          provider_refund_ref: string | null
          reason_code: string
          reason_detail: string
          request_fingerprint: string
          request_id: string
          requested_at: string
          requested_by: string
          restaurant_id: string
          scope: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          access_action?: string
          amount_minor: number
          cancellation_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          kind: string
          payment_attempt_id: string
          provider?: string
          provider_operation_id: string
          provider_payment_id: string
          provider_refund_ref?: string | null
          reason_code: string
          reason_detail: string
          request_fingerprint: string
          request_id: string
          requested_at: string
          requested_by: string
          restaurant_id: string
          scope: string
          status: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          access_action?: string
          amount_minor?: number
          cancellation_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          kind?: string
          payment_attempt_id?: string
          provider?: string
          provider_operation_id?: string
          provider_payment_id?: string
          provider_refund_ref?: string | null
          reason_code?: string
          reason_detail?: string
          request_fingerprint?: string
          request_id?: string
          requested_at?: string
          requested_by?: string
          restaurant_id?: string
          scope?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_refunds_cancellation_request_fk"
            columns: ["cancellation_request_id"]
            isOneToOne: false
            referencedRelation: "subscription_cancellation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_refunds_provider_operation_id_fkey"
            columns: ["provider_operation_id"]
            isOneToOne: true
            referencedRelation: "billing_provider_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscription_refunds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_refunds_restaurant_id_payment_attempt_id_fkey"
            columns: ["restaurant_id", "payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "subscription_payment_attempts"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "subscription_refunds_restaurant_id_subscription_id_invoice_fkey"
            columns: ["restaurant_id", "subscription_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["restaurant_id", "subscription_id", "id"]
          },
        ]
      }
      table_layout_requests: {
        Row: {
          created_at: string
          created_by: string
          request_id: string
          request_intent: Json
          restaurant_id: string
          result: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          request_id: string
          request_intent: Json
          restaurant_id: string
          result: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          request_id?: string
          request_intent?: Json
          restaurant_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "table_layout_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
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
          rotation_request_id: string | null
          rotation_request_reason: string | null
          rotation_requested_by: string | null
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
          rotation_request_id?: string | null
          rotation_request_reason?: string | null
          rotation_requested_by?: string | null
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
          rotation_request_id?: string | null
          rotation_request_reason?: string | null
          rotation_requested_by?: string | null
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
          close_kind: string
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
          close_kind?: string
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
          close_kind?: string
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
      table_transfer_item_splits: {
        Row: {
          moved_quantity: number
          operation_id: string
          source_items_before: Json
          source_order_id: string
          source_total_before: number
          target_order_id: string
        }
        Insert: {
          moved_quantity: number
          operation_id: string
          source_items_before: Json
          source_order_id: string
          source_total_before: number
          target_order_id: string
        }
        Update: {
          moved_quantity?: number
          operation_id?: string
          source_items_before?: Json
          source_order_id?: string
          source_total_before?: number
          target_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_transfer_item_splits_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "table_transfer_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_item_splits_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_item_splits_target_order_id_fkey"
            columns: ["target_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      table_transfer_operations: {
        Row: {
          created_at: string
          created_by: string
          financial_fingerprint: string
          id: string
          kind: string
          lock_reason: string | null
          request_id: string
          request_intent: Json
          restaurant_id: string
          source_session_closed: boolean
          source_session_id: string
          source_table_id: string
          status: string
          target_session_created: boolean
          target_session_id: string
          target_table_id: string
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          financial_fingerprint: string
          id?: string
          kind: string
          lock_reason?: string | null
          request_id: string
          request_intent: Json
          restaurant_id: string
          source_session_closed?: boolean
          source_session_id: string
          source_table_id: string
          status?: string
          target_session_created?: boolean
          target_session_id: string
          target_table_id: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          financial_fingerprint?: string
          id?: string
          kind?: string
          lock_reason?: string | null
          request_id?: string
          request_intent?: Json
          restaurant_id?: string
          source_session_closed?: boolean
          source_session_id?: string
          source_table_id?: string
          status?: string
          target_session_created?: boolean
          target_session_id?: string
          target_table_id?: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_transfer_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_operations_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_operations_source_table_id_fkey"
            columns: ["source_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_operations_target_session_id_fkey"
            columns: ["target_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_operations_target_table_id_fkey"
            columns: ["target_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_transfer_orders: {
        Row: {
          guest_session_id: string | null
          operation_id: string
          order_id: string
        }
        Insert: {
          guest_session_id?: string | null
          operation_id: string
          order_id: string
        }
        Update: {
          guest_session_id?: string | null
          operation_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_transfer_orders_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "table_transfer_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      table_transfer_shares: {
        Row: {
          operation_id: string
          share_id: string
        }
        Insert: {
          operation_id: string
          share_id: string
        }
        Update: {
          operation_id?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_transfer_shares_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "table_transfer_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_transfer_shares_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "payment_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          area_label: string | null
          created_at: string
          deleted_at: string | null
          floor_label: string | null
          id: string
          label: string
          layout_rotation: number
          layout_shape: string
          layout_x_bp: number | null
          layout_y_bp: number | null
          qr_code_url: string | null
          restaurant_id: string
          seat_count: number
          updated_at: string
        }
        Insert: {
          area_label?: string | null
          created_at?: string
          deleted_at?: string | null
          floor_label?: string | null
          id?: string
          label: string
          layout_rotation?: number
          layout_shape?: string
          layout_x_bp?: number | null
          layout_y_bp?: number | null
          qr_code_url?: string | null
          restaurant_id: string
          seat_count?: number
          updated_at?: string
        }
        Update: {
          area_label?: string | null
          created_at?: string
          deleted_at?: string | null
          floor_label?: string | null
          id?: string
          label?: string
          layout_rotation?: number
          layout_shape?: string
          layout_x_bp?: number | null
          layout_y_bp?: number | null
          qr_code_url?: string | null
          restaurant_id?: string
          seat_count?: number
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
      tenant_feature_overrides: {
        Row: {
          created_at: string
          decision: string
          expires_at: string
          feature: string
          reason: string
          request_id: string
          restaurant_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          decision: string
          expires_at: string
          feature: string
          reason: string
          request_id: string
          restaurant_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          decision?: string
          expires_at?: string
          feature?: string
          reason?: string
          request_id?: string
          restaurant_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
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
      tenant_privacy_operations: {
        Row: {
          id: string
          operation_type: string
          reason: string
          request_id: string
          requested_at: string
          requested_by: string
          restaurant_id: string
          result_digest: string | null
          result_summary: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          operation_type: string
          reason: string
          request_id: string
          requested_at?: string
          requested_by: string
          restaurant_id: string
          result_digest?: string | null
          result_summary?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          operation_type?: string
          reason?: string
          request_id?: string
          requested_at?: string
          requested_by?: string
          restaurant_id?: string
          result_digest?: string | null
          result_summary?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_privacy_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_service_controls: {
        Row: {
          changed_by: string
          created_at: string
          reason: string
          restaurant_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          changed_by: string
          created_at?: string
          reason: string
          restaurant_id: string
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          changed_by?: string
          created_at?: string
          reason?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_service_controls_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "platform_admin_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tenant_service_controls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_config_history: {
        Row: {
          id: string
          published_at: string
          published_by: string | null
          request_fingerprint: string | null
          request_id: string | null
          restaurant_id: string
          revision: number
          template_id: string
          tokens: Json
        }
        Insert: {
          id?: string
          published_at: string
          published_by?: string | null
          request_fingerprint?: string | null
          request_id?: string | null
          restaurant_id: string
          revision: number
          template_id: string
          tokens: Json
        }
        Update: {
          id?: string
          published_at?: string
          published_by?: string | null
          request_fingerprint?: string | null
          request_id?: string | null
          restaurant_id?: string
          revision?: number
          template_id?: string
          tokens?: Json
        }
        Relationships: [
          {
            foreignKeyName: "theme_config_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_configs: {
        Row: {
          component_overrides: Json
          created_at: string
          id: string
          published_at: string
          restaurant_id: string
          revision: number
          tokens: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          component_overrides?: Json
          created_at?: string
          id?: string
          published_at: string
          restaurant_id: string
          revision?: number
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          component_overrides?: Json
          created_at?: string
          id?: string
          published_at?: string
          restaurant_id?: string
          revision?: number
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
      theme_draft_operations: {
        Row: {
          created_at: string
          expected_revision: number
          request_fingerprint: string
          request_id: string
          restaurant_id: string
          result: Json
          saved_by: string
          template_id: string
          tokens: Json
        }
        Insert: {
          created_at?: string
          expected_revision: number
          request_fingerprint: string
          request_id: string
          restaurant_id: string
          result: Json
          saved_by: string
          template_id: string
          tokens: Json
        }
        Update: {
          created_at?: string
          expected_revision?: number
          request_fingerprint?: string
          request_id?: string
          restaurant_id?: string
          result?: Json
          saved_by?: string
          template_id?: string
          tokens?: Json
        }
        Relationships: [
          {
            foreignKeyName: "theme_draft_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_drafts: {
        Row: {
          based_on_published_revision: number
          restaurant_id: string
          revision: number
          template_id: string
          tokens: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          based_on_published_revision?: number
          restaurant_id: string
          revision?: number
          template_id: string
          tokens: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          based_on_published_revision?: number
          restaurant_id?: string
          revision?: number
          template_id?: string
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theme_drafts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_publish_operations: {
        Row: {
          created_at: string
          draft_revision: number | null
          expected_revision: number
          published_by: string
          request_fingerprint: string
          request_id: string
          restaurant_id: string
          result: Json
          template_id: string
          tokens: Json
        }
        Insert: {
          created_at?: string
          draft_revision?: number | null
          expected_revision: number
          published_by: string
          request_fingerprint: string
          request_id: string
          restaurant_id: string
          result: Json
          template_id: string
          tokens: Json
        }
        Update: {
          created_at?: string
          draft_revision?: number | null
          expected_revision?: number
          published_by?: string
          request_fingerprint?: string
          request_id?: string
          restaurant_id?: string
          result?: Json
          template_id?: string
          tokens?: Json
        }
        Relationships: [
          {
            foreignKeyName: "theme_publish_operations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      payment_credential_status: {
        Row: {
          mode: string | null
          protection: string | null
          restaurant_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ack_domain_outbox: {
        Args: { p_event_id: string; p_worker: string }
        Returns: boolean
      }
      add_on_purchase_json: {
        Args: { p: Database["public"]["Tables"]["add_on_purchases"]["Row"] }
        Returns: Json
      }
      add_on_reconciliation_interval: {
        Args: { p_age: string; p_status: string }
        Returns: string
      }
      advance_billing_dunning: {
        Args: {
          p_completed_step: string
          p_occurred_at: string
          p_run_id: string
          p_worker: string
        }
        Returns: string
      }
      advance_restaurant_onboarding_branding: {
        Args: {
          p_accent: string
          p_expected_revision: number
          p_request_id: string
          p_restaurant_id: string
          p_theme: Json
        }
        Returns: Json
      }
      apply_add_on_payment: {
        Args: { p_evidence: Json; p_id: string }
        Returns: Json
      }
      apply_due_subscription_cancellation_access: {
        Args: { p_limit?: number; p_occurred_at?: string }
        Returns: Json
      }
      apply_order_loyalty_adjustment: {
        Args: {
          p_force_full?: boolean
          p_order_id: string
          p_refund_id?: string
        }
        Returns: {
          adjustment_delta: number
          adjustment_direction: string
          linked_refund_id: string
          loyalty_type: string
        }[]
      }
      apply_paid_subscription_plan_changes: {
        Args: { p_limit?: number; p_occurred_at?: string }
        Returns: number
      }
      assert_customer_identity_role_available: {
        Args: { p_target_role: string; p_user_id: string }
        Returns: undefined
      }
      assert_dashboard_onboarding_identity: { Args: never; Returns: undefined }
      assert_platform_account_admin: {
        Args: { p_actor_role: string; p_actor_user_id: string }
        Returns: undefined
      }
      attach_add_on_checkout: {
        Args: { p_id: string; p_token: string; p_url: string }
        Returns: undefined
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
      attach_order_provider_payment: {
        Args: {
          p_currency: string
          p_order_id: string
          p_paid_price: number
          p_provider_payment_id: string
          p_restaurant_id: string
          p_token: string
        }
        Returns: boolean
      }
      attach_split_checkout_token: {
        Args: { p_restaurant_id: string; p_share_id: string; p_token: string }
        Returns: boolean
      }
      audit_media_storage: { Args: never; Returns: Json }
      bind_subscription_checkout_provider_plan: {
        Args: { p_expected_provider_plan_ref: string; p_operation_id: string }
        Returns: boolean
      }
      bind_subscription_payment_provider_id: {
        Args: {
          p_invoice_id: string
          p_provider_invoice_ref: string
          p_provider_payment_id: string
        }
        Returns: boolean
      }
      bootstrap_platform_superadmin: {
        Args: {
          p_display_name: string
          p_reason: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      build_restaurant_onboarding_snapshot: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      cancel_paid_manual_order_with_refund: {
        Args: {
          p_actor_user_id: string
          p_order_id: string
          p_reason: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      change_platform_admin_tenant_feature_override: {
        Args: {
          p_action: string
          p_actor_role: string
          p_actor_user_id: string
          p_decision: string
          p_duration_days: number
          p_feature: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      check_dashboard_session: { Args: never; Returns: undefined }
      checkpoint_accounting_invoice_job:
        | {
            Args: {
              p_fiscal_document_type: string
              p_job_id: string
              p_provider_contact_ref: string
              p_provider_invoice_ref: string
              p_provider_task_ref: string
              p_worker_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_fiscal_document_type: string
              p_job_id: string
              p_provider_contact_ref: string
              p_provider_document_ref: string
              p_provider_invoice_ref: string
              p_provider_task_ref: string
              p_worker_id: string
            }
            Returns: boolean
          }
      claim_accounting_invoice_jobs: {
        Args: { p_limit?: number; p_provider_name: string; p_worker_id: string }
        Returns: Json
      }
      claim_accounting_invoice_jobs_before_add_on: {
        Args: { p_limit?: number; p_provider_name: string; p_worker_id: string }
        Returns: Json
      }
      claim_active_customer_guest_orders: {
        Args: {
          p_customer_id: string
          p_device_proof_hash: string
          p_guest_session_id: string
          p_request_id: string
          p_restaurant_id: string
          p_table_token: string
        }
        Returns: number
      }
      claim_billing_dunning: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: {
          invoice_id: string
          restaurant_id: string
          run_id: string
          step: string
          subscription_id: string
        }[]
      }
      claim_billing_reconciliation: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: {
          job_id: string
          restaurant_id: string
          scope: string
          subscription_id: string
        }[]
      }
      claim_campaign_recipient: {
        Args: { p_campaign_id: string; p_restaurant_id: string }
        Returns: {
          attempts: number
          campaign_id: string
          clicked_at: string | null
          created_at: string
          customer_id: string
          delivery_status: string
          email: string | null
          error: string | null
          id: string
          last_event_at: string | null
          locked_at: string | null
          normalized_email: string | null
          normalized_phone: string | null
          opened_at: string | null
          phone: string | null
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
      claim_customer_identity_atomic: {
        Args: {
          p_auth_user_id: string
          p_email: string
          p_name: string
          p_verified_phone?: string
        }
        Returns: {
          email: string
          id: string
          merged: boolean
          name: string
        }[]
      }
      claim_customer_identity_atomic_v2: {
        Args: {
          p_auth_user_id: string
          p_email?: string
          p_name?: string
          p_verified_phone?: string
        }
        Returns: {
          email: string
          id: string
          merged: boolean
          name: string
        }[]
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
      claim_due_subscription_cancellations: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_occurred_at?: string
          p_worker: string
        }
        Returns: Json
      }
      claim_menu_translation_job: {
        Args: { p_budget_microdollars?: number }
        Returns: Json
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
      claim_subscription_billing_operation: {
        Args: {
          p_idempotency_key: string
          p_invoice_id: string
          p_operation_type: string
          p_request_fingerprint: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      claim_subscription_cancellations_before_renewal: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_occurred_at?: string
          p_worker: string
        }
        Returns: Json
      }
      claim_subscription_checkout_recovery: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: Json
      }
      claim_subscription_checkout_recovery_operation: {
        Args: {
          p_lease_seconds?: number
          p_operation_id: string
          p_restaurant_id: string
          p_worker: string
        }
        Returns: Json
      }
      claim_subscription_invoice_hydration: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker: string }
        Returns: Json
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
      complete_accounting_invoice_job:
        | {
            Args: {
              p_fiscal_document_type: string
              p_job_id: string
              p_provider_contact_ref: string
              p_provider_invoice_ref: string
              p_worker_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_fiscal_document_type: string
              p_job_id: string
              p_provider_contact_ref: string
              p_provider_document_ref: string
              p_provider_invoice_ref: string
              p_worker_id: string
            }
            Returns: boolean
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
      complete_onboarding_csv_menu: {
        Args: {
          p_expected_revision: number
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      complete_platform_subscription_refund: {
        Args: {
          p_amount_minor: number
          p_occurred_at?: string
          p_operation_id: string
          p_provider_payment_id: string
          p_provider_refund_ref: string
          p_refund_id: string
        }
        Returns: Json
      }
      complete_subscription_billing_operation: {
        Args: { p_operation_id: string; p_result_sanitized: Json }
        Returns: boolean
      }
      complete_subscription_cancellation_provider_cutoff: {
        Args: {
          p_cancellation_request_id: string
          p_cancellation_target_id: string
          p_occurred_at?: string
          p_operation_id: string
          p_provider_cancelled_at: string
          p_worker: string
        }
        Returns: Json
      }
      complete_subscription_cancellation_target: {
        Args: {
          p_cancellation_request_id: string
          p_cancellation_target_id: string
          p_occurred_at?: string
          p_operation_id: string
          p_provider_cancelled_at: string
          p_worker: string
        }
        Returns: Json
      }
      complete_subscription_card_update: {
        Args: {
          p_callback_state: string
          p_occurred_at: string
          p_provider_checkout_ref: string
        }
        Returns: Json
      }
      configure_accounting_invoice_worker_vault: {
        Args: { p_secret: string; p_url: string }
        Returns: Json
      }
      configure_media_cleanup_vault: {
        Args: { p_secret: string; p_url: string }
        Returns: Json
      }
      configure_menu_translation_worker_vault: {
        Args: { p_secret: string; p_url: string }
        Returns: Json
      }
      configure_outbox_worker_vault: {
        Args: { p_secret: string; p_url: string }
        Returns: Json
      }
      consume_customer_auth_intent: {
        Args: { p_context_hash: string; p_nonce_hash: string }
        Returns: boolean
      }
      consume_customer_auth_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      consume_dashboard_auth_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_subject_hash: string
          p_window_seconds: number
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
      converge_paid_subscription_plan_change: {
        Args: {
          p_invoice_id: string
          p_occurred_at: string
          p_provider_event_id: string
          p_restaurant_id: string
          p_subscription_id: string
        }
        Returns: Json
      }
      create_customer_privacy_export: {
        Args: { p_customer_id: string; p_request_id: string }
        Returns: Json
      }
      create_located_table: {
        Args: {
          p_area_label: string
          p_floor_label: string
          p_label: string
          p_restaurant_id: string
        }
        Returns: {
          outcome: string
          table_id: string
          token: string
        }[]
      }
      create_located_table_with_plan_limit: {
        Args: {
          p_area_label: string
          p_floor_label: string
          p_label: string
          p_restaurant_id: string
        }
        Returns: {
          outcome: string
          table_id: string
          table_limit: number
          token: string
        }[]
      }
      create_onboarding_first_menu_item: {
        Args: {
          p_category_name: string
          p_description: string
          p_expected_revision: number
          p_item_name: string
          p_price: number
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      create_restaurant_with_pro_trial: {
        Args: { p_intended_plan?: string; p_name: string; p_slug: string }
        Returns: Json
      }
      create_restaurant_with_pro_trial_v2: {
        Args: {
          p_intended_plan: string
          p_name: string
          p_request_id: string
          p_slug: string
          p_timezone: string
        }
        Returns: Json
      }
      create_restaurant_with_pro_trial_v3: {
        Args: {
          p_intended_interval: string
          p_intended_plan: string
          p_name: string
          p_request_id: string
          p_slug: string
          p_timezone: string
        }
        Returns: Json
      }
      create_split_share_guarded: {
        Args: {
          p_active_max: number
          p_amount: number
          p_assigned_items: Json | null
          p_customer_id: string | null
          p_label: string | null
          p_method: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_table_id: string
          p_table_session_id: string
        }
        Returns: Json
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
      create_table: {
        Args: { p_label: string; p_restaurant_id: string }
        Returns: {
          outcome: string
          table_id: string
          token: string
        }[]
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
      dashboard_media_staging: {
        Args: { p_input: Json; p_op: string }
        Returns: Json
      }
      dashboard_session_is_verified: { Args: never; Returns: boolean }
      defer_domain_outbox: {
        Args: {
          p_delay_seconds?: number
          p_event_id: string
          p_reason: string
          p_worker: string
        }
        Returns: boolean
      }
      delete_customer_favorite: {
        Args: {
          p_customer_id: string
          p_menu_item_id: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      delete_menu_category: {
        Args: { p_category_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      delete_payment_credential_vault: {
        Args: {
          p_actor_user_id: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      dismiss_restaurant_onboarding_checklist: {
        Args: {
          p_expected_revision: number
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      dispatch_media_cleanup: { Args: never; Returns: boolean }
      end_platform_admin_impersonation_session: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
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
      enqueue_refund_subscription_cancellation: {
        Args: { p_occurred_at?: string; p_refund_id: string }
        Returns: string
      }
      enqueue_subscription_lifecycle_notifications: {
        Args: {
          p_limit?: number
          p_occurred_at?: string
          p_restaurant_id?: string
        }
        Returns: Json
      }
      enqueue_subscription_upcoming_invoice_reminders: {
        Args: { p_limit?: number; p_occurred_at?: string }
        Returns: number
      }
      erase_platform_admin_tenant_privacy_data: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      escalate_billing_reconciliation: {
        Args: {
          p_discrepancy_code: string
          p_job_id: string
          p_occurred_at: string
          p_worker: string
        }
        Returns: boolean
      }
      execute_inventory: {
        Args: {
          p_actor_id: string
          p_mode: string
          p_payload?: Json
          p_request_id?: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      execute_menu_bulk: {
        Args: {
          p_actor_id: string
          p_mode: string
          p_offset?: number
          p_operation_id?: string
          p_patches?: Json
          p_request_id?: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      execute_menu_translation: {
        Args: {
          p_actor: string
          p_mode: string
          p_payload?: Json
          p_request?: string
          p_restaurant: string
        }
        Returns: Json
      }
      expire_subscription_checkout_recovery: {
        Args: { p_operation_id: string; p_worker: string }
        Returns: boolean
      }
      export_owner_tenant_privacy_data: {
        Args: {
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      export_platform_admin_tenant_privacy_data: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      fail_accounting_invoice_job: {
        Args: {
          p_error_code: string
          p_job_id: string
          p_retryable: boolean
          p_worker_id: string
        }
        Returns: boolean
      }
      fail_add_on_initialization: { Args: { p_id: string }; Returns: undefined }
      fail_billing_dunning: {
        Args: {
          p_reason: string
          p_retry_delay_seconds?: number
          p_run_id: string
          p_worker: string
        }
        Returns: boolean
      }
      fail_billing_reconciliation: {
        Args: {
          p_job_id: string
          p_reason: string
          p_retry_delay_seconds?: number
          p_worker: string
        }
        Returns: boolean
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
      fail_iyzico_order_refund: {
        Args: {
          p_actor_user_id: string
          p_failure_code: string
          p_failure_message: string
          p_order_id: string
          p_refund_id: string
          p_restaurant_id: string
          p_status: string
        }
        Returns: boolean
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
      fail_platform_subscription_refund: {
        Args: {
          p_failure_code: string
          p_occurred_at?: string
          p_operation_id: string
          p_refund_id: string
          p_requires_reconciliation: boolean
        }
        Returns: Json
      }
      fail_subscription_cancellation_target: {
        Args: {
          p_cancellation_request_id: string
          p_cancellation_target_id: string
          p_operation_id: string
          p_reason: string
          p_worker: string
        }
        Returns: boolean
      }
      fail_subscription_invoice_hydration: {
        Args: {
          p_job_id: string
          p_provider_event_id: string
          p_reason: string
          p_retry_delay_seconds?: number
          p_worker: string
        }
        Returns: boolean
      }
      finalize_campaign_delivery: {
        Args: { p_campaign_id: string; p_restaurant_id: string }
        Returns: string
      }
      finalize_iyzico_order_refund: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_order_id: string
          p_provider_payment_id: string
          p_provider_refund_ref: string
          p_refund_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      finalize_order_discount: {
        Args: {
          p_catalog_discount: number
          p_catalog_item_name: string
          p_catalog_points_cost: number
          p_coupon: string
          p_coupon_catalog_eligible_discount: number
          p_coupon_eligible_subtotal: number
          p_coupon_stamp_eligible_discount: number
          p_coupon_updated_at: string
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
      finalize_subscription_cancellation: {
        Args: {
          p_actor_user_id: string
          p_cancelled_at: string
          p_operation_id: string
          p_request_id: string
        }
        Returns: Json
      }
      finalize_subscription_checkout_operation: {
        Args: {
          p_operation_id: string
          p_period_end: string
          p_period_start: string
          p_provider_customer_ref: string
          p_provider_invoice_ref: string
          p_provider_plan_ref: string
          p_provider_subscription_ref: string
        }
        Returns: Json
      }
      finalize_subscription_checkout_with_payment_identity: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_operation_id: string
          p_period_end: string
          p_period_start: string
          p_provider_customer_ref: string
          p_provider_invoice_ref: string
          p_provider_order_status: string
          p_provider_payment_id: string
          p_provider_plan_ref: string
          p_provider_subscription_ref: string
        }
        Returns: Json
      }
      finalize_subscription_plan_change: {
        Args: {
          p_change_request_id: string
          p_occurred_at: string
          p_operation_id: string
          p_provider_parent_subscription_ref: string
          p_provider_period_end: string
          p_provider_period_start: string
          p_provider_status: string
          p_provider_target_plan_ref: string
          p_provider_target_subscription_ref: string
        }
        Returns: Json
      }
      find_subscription_checkout_callback: {
        Args: { p_provider_checkout_ref: string }
        Returns: Json
      }
      finish_menu_translation_job: {
        Args: {
          p_error?: string
          p_input_tokens?: number
          p_job: string
          p_lease: string
          p_output_tokens?: number
          p_translations?: Json
        }
        Returns: string
      }
      finish_platform_admin_user_unban: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_rejected?: boolean
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      get_customer_loyalty_activity_page: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_customer_id: string
          p_limit?: number
          p_restaurant_id: string
          p_scope_key: string
        }
        Returns: {
          delta: number
          direction: string
          event_at: string
          event_id: string
          loyalty_type: string
          reason: string
        }[]
      }
      get_customer_loyalty_aggregates: {
        Args: { p_customer_id: string }
        Returns: {
          latest_activity_at: string
          lifetime_points: number
          points: number
          restaurant_id: string
          scope_key: string
          stamps: number
          visits: number
        }[]
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
      get_notification_delivery_health: {
        Args: never
        Returns: {
          consumer: string
          dead_letter_count: number
          failed_count: number
          last_success_at: string
          pending_count: number
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
      get_restaurant_customer_timeline: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_before_kind?: string
          p_customer_id: string
          p_limit?: number
          p_restaurant_id: string
        }
        Returns: {
          amount: number
          collected: boolean
          delta: number
          direction: string
          event_at: string
          event_id: string
          event_kind: string
          loyalty_type: string
          paid: boolean
          reason: string
          status: string
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
      grant_legacy_add_on_ownership: {
        Args: { p_add_on: string; p_invoice_id: string }
        Returns: boolean
      }
      grant_store_credit_atomic: {
        Args: {
          p_customer_id: string
          p_granted_by: string
          p_note: string
          p_points: number
          p_request_id: string
          p_restaurant_id: string
          p_scope_key: string
        }
        Returns: {
          granted: number
          replayed: boolean
          transaction_id: string
        }[]
      }
      has_current_signup_legal_evidence: { Args: never; Returns: boolean }
      has_restaurant_access: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      has_restaurant_section: {
        Args: { p_restaurant_id: string; p_section: string }
        Returns: boolean
      }
      hydrate_subscription_invoice_from_provider_event: {
        Args: {
          p_add_ons: string[]
          p_amount_minor: number
          p_billing_interval: string
          p_currency: string
          p_job_id: string
          p_occurred_at: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_provider_customer_ref: string
          p_provider_event_id: string
          p_provider_invoice_ref: string
          p_provider_order_status: string
          p_provider_plan_ref: string
          p_provider_subscription_ref: string
          p_worker: string
        }
        Returns: Json
      }
      hydrate_subscription_invoice_with_payment_identity: {
        Args: {
          p_add_ons: string[]
          p_amount_minor: number
          p_billing_interval: string
          p_currency: string
          p_job_id: string
          p_occurred_at: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_provider_customer_ref: string
          p_provider_event_id: string
          p_provider_invoice_ref: string
          p_provider_order_status: string
          p_provider_payment_id: string | null
          p_provider_plan_ref: string
          p_provider_subscription_ref: string
          p_worker: string
        }
        Returns: Json
      }
      import_menu_rows: {
        Args: { p_restaurant_id: string; p_rows: Json }
        Returns: Json
      }
      ingest_subscription_billing_provider_event: {
        Args: {
          p_event_type: string
          p_payload_hash: string
          p_payload_sanitized: Json
          p_provider_customer_ref: string
          p_provider_event_id: string
          p_provider_invoice_ref: string
          p_provider_subscription_ref: string
        }
        Returns: Json
      }
      intervene_platform_admin_billing_dunning: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_defer_days: number
          p_intervention: string
          p_invoice_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      inventory_actor: {
        Args: { p_actor: string; p_owner?: boolean; p_restaurant: string }
        Returns: boolean
      }
      inventory_allowed: { Args: { p_restaurant: string }; Returns: boolean }
      inventory_decimal: {
        Args: { p: string; p_signed?: boolean }
        Returns: number
      }
      inventory_post: {
        Args: {
          p_cost?: number
          p_document: string
          p_item: string
          p_quantity: number
          p_restaurant: string
          p_reversal?: string
        }
        Returns: string
      }
      inventory_snapshot: {
        Args: { p_as_of?: string; p_offset?: number; p_restaurant: string }
        Returns: Json
      }
      inventory_sync_transfer: {
        Args: { p_operation: string; p_restaurant: string; p_undo: boolean }
        Returns: undefined
      }
      invoke_accounting_invoice_worker: { Args: never; Returns: number }
      invoke_domain_outbox_worker: { Args: never; Returns: number }
      invoke_menu_translation_worker: { Args: never; Returns: number }
      is_restaurant_owner: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      is_staff_or_platform_user: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_staff_user: { Args: { p_user_id: string }; Returns: boolean }
      is_valid_subscription_add_on_selection: {
        Args: { p_add_ons: string[]; p_plan: string }
        Returns: boolean
      }
      list_active_table_qr_tokens: {
        Args: { p_restaurant_id: string }
        Returns: {
          table_id: string
          token: string
        }[]
      }
      list_add_on_reconciliation_purchases: { Args: never; Returns: Json }
      list_organization_restaurant_ids_for_user: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      list_platform_admin_tenants: {
        Args: {
          p_lifecycle?: string
          p_limit?: number
          p_offset?: number
          p_plan?: string
          p_search?: string
          p_subscription_status?: string
        }
        Returns: Json
      }
      list_table_transfer_history: {
        Args: { p_limit?: number; p_restaurant_id: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          kind: string
          lock_reason: string
          order_count: number
          request_id: string
          source_session_closed: boolean
          source_session_id: string
          source_table_id: string
          status: string
          target_session_created: boolean
          target_session_id: string
          target_table_id: string
          undone_at: string
          undone_by: string
        }[]
      }
      lock_customer_identity_role: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      mark_subscription_billing_operation_reconciliation: {
        Args: { p_operation_id: string; p_reason: string }
        Returns: boolean
      }
      mark_subscription_billing_provider_event_failed: {
        Args: {
          p_provider_event_id: string
          p_provider_snapshot_sanitized: Json
          p_reason: string
        }
        Returns: boolean
      }
      mark_subscription_card_update_initialized: {
        Args: {
          p_operation_id: string
          p_provider_checkout_expires_at: string
          p_provider_checkout_ref: string
        }
        Returns: boolean
      }
      mark_subscription_checkout_initialized: {
        Args: {
          p_operation_id: string
          p_provider_checkout_expires_at: string
          p_provider_checkout_ref: string
        }
        Returns: boolean
      }
      media_actor: {
        Args: { p_actor: string; p_context: string; p_restaurant: string }
        Returns: boolean
      }
      media_asset_json: { Args: { p_id: string }; Returns: Json }
      media_command: {
        Args: {
          p_actor: string
          p_context: string
          p_mode: string
          p_payload?: Json
          p_restaurant: string
        }
        Returns: Json
      }
      media_command_core: {
        Args: {
          p_actor: string
          p_context: string
          p_mode: string
          p_payload?: Json
          p_restaurant: string
        }
        Returns: Json
      }
      media_limit: { Args: { p_restaurant: string }; Returns: number }
      media_maintenance: {
        Args: { p_mode: string; p_payload?: Json }
        Returns: Json
      }
      media_reference_sync: {
        Args: {
          p_doc: Json
          p_id: string
          p_restaurant: string
          p_table: string
        }
        Returns: undefined
      }
      media_urls: { Args: { p_doc: Json }; Returns: string[] }
      menu_category_restaurant: {
        Args: { p_category_id: string }
        Returns: string
      }
      menu_translation_actor: {
        Args: { p_actor: string; p_owner?: boolean; p_restaurant: string }
        Returns: boolean
      }
      menu_translation_allowed: {
        Args: { p_restaurant: string }
        Returns: boolean
      }
      menu_translation_enqueue: {
        Args: { p_keys?: Json; p_regenerate?: boolean; p_restaurant: string }
        Returns: number
      }
      menu_translation_quota: { Args: { p_restaurant: string }; Returns: Json }
      menu_translation_snapshot: {
        Args: { p_actor: string; p_restaurant: string }
        Returns: Json
      }
      menu_translation_sources: {
        Args: { p_restaurant: string }
        Returns: {
          key: string
          label: string
          source: string
        }[]
      }
      menu_translation_sync: {
        Args: { p_restaurant: string }
        Returns: undefined
      }
      merge_customer_identity_into: {
        Args: { p_merged: string; p_survivor: string; p_triggered_by: string }
        Returns: undefined
      }
      move_table_session: {
        Args: {
          p_actor_id: string
          p_request_id: string
          p_restaurant_id: string
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
      }
      mutate_team_member_with_audit: {
        Args: {
          p_actor_user_id: string
          p_member_id: string
          p_operation: string
          p_permissions?: Json
          p_restaurant_id: string
          p_status?: string
        }
        Returns: Json
      }
      normalize_customer_search_phone: {
        Args: { p_value: string }
        Returns: string
      }
      normalize_customer_search_text: {
        Args: { p_value: string }
        Returns: string
      }
      normalize_marketing_email: { Args: { p_value: string }; Returns: string }
      normalize_sms_phone: { Args: { p_value: string }; Returns: string }
      open_or_get_table_session: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      patch_restaurant_qr_style: {
        Args: {
          p_expected_revision: number
          p_qr_style: Json
          p_restaurant_id: string
        }
        Returns: {
          outcome: string
          revision: number
          style: Json
        }[]
      }
      patch_restaurant_settings_atomic: {
        Args: { p_patch: Json; p_restaurant_id: string }
        Returns: boolean
      }
      patch_restaurant_settings_cas: {
        Args: {
          p_expected_settings: Json
          p_patch: Json
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      prepare_add_on_purchase: {
        Args: {
          p_add_on: string
          p_price_version: number
          p_request_id: string
          p_restaurant_id: string
          p_return_context: Json
          p_user_id: string
        }
        Returns: Json
      }
      prepare_platform_admin_user_unban: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      prepare_platform_subscription_refund: {
        Args: {
          p_access_action: string
          p_actor_role: string
          p_actor_user_id: string
          p_amount_minor: number
          p_idempotency_key: string
          p_invoice_id: string
          p_kind: string
          p_occurred_at?: string
          p_reason_code: string
          p_reason_detail: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      prepare_subscription_card_update: {
        Args: {
          p_callback_state_hash: string
          p_idempotency_key: string
          p_request_fingerprint: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      prepare_subscription_checkout_operation: {
        Args: {
          p_amount_minor: number
          p_billing_address: Json
          p_billing_interval: string
          p_contact_email: string
          p_contact_name: string
          p_contact_surname: string
          p_due_at: string
          p_gsm_number: string
          p_idempotency_key: string
          p_identity_number: string
          p_legal_name: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_request_fingerprint: string
          p_restaurant_id: string
          p_shipping_address: Json
        }
        Returns: Json
      }
      prepare_subscription_checkout_with_add_ons_operation: {
        Args: {
          p_add_ons: string[]
          p_amount_minor: number
          p_billing_address: Json
          p_billing_interval: string
          p_contact_email: string
          p_contact_name: string
          p_contact_surname: string
          p_due_at: string
          p_expected_provider_plan_ref: string
          p_gsm_number: string
          p_idempotency_key: string
          p_identity_number: string
          p_legal_name: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_request_fingerprint: string
          p_restaurant_id: string
          p_shipping_address: Json
        }
        Returns: Json
      }
      prepare_subscription_plan_change: {
        Args: {
          p_effective_policy: string
          p_idempotency_key: string
          p_provider_target_plan_ref: string
          p_request_fingerprint: string
          p_requested_by: string
          p_restaurant_id: string
          p_to_add_ons: string[]
          p_to_billing_interval: string
          p_to_plan: string
        }
        Returns: Json
      }
      prune_dashboard_query_observations: { Args: never; Returns: number }
      prune_dashboard_security_events: { Args: never; Returns: number }
      prune_platform_error_events: { Args: never; Returns: number }
      publish_saved_theme_draft_atomic: {
        Args: {
          p_expected_draft_revision: number
          p_expected_published_revision: number
          p_published_by: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      publish_theme_config_atomic: {
        Args: {
          p_expected_revision: number
          p_published_by: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_template_id: string
          p_tokens: Json
        }
        Returns: Json
      }
      put_customer_favorites: {
        Args: {
          p_customer_id: string
          p_menu_item_ids: string[]
          p_restaurant_id: string
        }
        Returns: string[]
      }
      queue_campaign_delivery_atomic: {
        Args: {
          p_builtin_segment: string
          p_contacts: Json
          p_created_by: string
          p_custom_segment_id: string
          p_message_body: string
          p_name: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_segment_definition: Json
          p_segment_kind: string
          p_segment_label: string
        }
        Returns: {
          campaign_id: string
          recipient_count: number
          replayed: boolean
          skipped_consent_count: number
          skipped_duplicate_count: number
          skipped_phone_count: number
        }[]
      }
      queue_email_campaign_delivery_atomic: {
        Args: {
          p_builtin_segment: string
          p_channel: string
          p_contacts: Json
          p_content_mode: string
          p_created_by: string
          p_custom_segment_id: string
          p_message_body: string
          p_name: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_segment_definition: Json
          p_segment_kind: string
          p_segment_label: string
          p_subject: string
          p_template_id: string
        }
        Returns: {
          campaign_id: string
          recipient_count: number
          replayed: boolean
          skipped_consent_count: number
          skipped_contact_count: number
          skipped_duplicate_count: number
        }[]
      }
      queue_email_campaign_delivery_v2_atomic: {
        Args: {
          p_builtin_segment: string
          p_channel: string
          p_contacts: Json
          p_content_mode: string
          p_created_by: string
          p_custom_segment_id: string
          p_email_design: Json
          p_message_body: string
          p_name: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_segment_definition: Json
          p_segment_kind: string
          p_segment_label: string
          p_subject: string
          p_template_id: string
        }
        Returns: {
          campaign_id: string
          recipient_count: number
          replayed: boolean
          skipped_consent_count: number
          skipped_contact_count: number
          skipped_duplicate_count: number
        }[]
      }
      queue_marketing_campaign_delivery_atomic: {
        Args: {
          p_builtin_segment: string
          p_channel: string
          p_contacts: Json
          p_created_by: string
          p_custom_segment_id: string
          p_message_body: string
          p_name: string
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_segment_definition: Json
          p_segment_kind: string
          p_segment_label: string
          p_subject: string
        }
        Returns: {
          campaign_id: string
          recipient_count: number
          replayed: boolean
          skipped_consent_count: number
          skipped_contact_count: number
          skipped_duplicate_count: number
        }[]
      }
      reactivate_platform_admin_tenant_member: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_member_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      read_active_tenant_feature_override: {
        Args: { p_feature: string; p_restaurant_id: string }
        Returns: Json
      }
      read_add_on_invoice_document: {
        Args: { p_invoice_id: string; p_restaurant_id: string }
        Returns: Json
      }
      read_add_on_price_history: { Args: never; Returns: Json }
      read_add_on_purchase: {
        Args: { p_id?: string; p_token?: string }
        Returns: Json
      }
      read_add_on_store: { Args: { p_restaurant_id: string }; Returns: Json }
      read_analytics_abnormal_close_aggregate: {
        Args: { p_before: string; p_restaurant_id: string; p_since: string }
        Returns: Json
      }
      read_analytics_cancellation_aggregate: {
        Args: {
          p_before: string
          p_current_start: string
          p_payment_method: string | null
          p_restaurant_id: string
          p_since: string
          p_source: string | null
          p_timezone: string
        }
        Returns: Json
      }
      read_analytics_core_metrics: {
        Args: {
          p_before: string
          p_current_start: string
          p_payment_method: string | null
          p_restaurant_id: string
          p_since: string
          p_source: string | null
          p_status: string | null
          p_timezone: string
        }
        Returns: Json
      }
      read_analytics_payment_aggregate: {
        Args: {
          p_before: string
          p_payment_method: string | null
          p_restaurant_id: string
          p_since: string
          p_source: string | null
          p_status: string | null
        }
        Returns: Json
      }
      read_analytics_staff_settlement_aggregate: {
        Args: {
          p_before: string
          p_payment_method: string | null
          p_restaurant_id: string
          p_since: string
          p_source: string | null
          p_status: string | null
        }
        Returns: Json
      }
      read_analytics_table_performance: {
        Args: {
          p_before: string
          p_payment_method: string | null
          p_restaurant_id: string
          p_since: string
          p_source: string | null
          p_status: string | null
        }
        Returns: Json
      }
      read_customer_favorites: {
        Args: { p_customer_id: string; p_restaurant_id?: string }
        Returns: {
          created_at: string
          menu_item_description: string
          menu_item_id: string
          menu_item_images: Json
          menu_item_name: string
          menu_item_price: number
          restaurant_id: string
          restaurant_logo_url: string
          restaurant_name: string
          restaurant_slug: string
        }[]
      }
      read_dashboard_pano_metrics: {
        Args: {
          p_heatmap_start: string
          p_restaurant_id: string
          p_timezone: string
          p_today_start: string
          p_yesterday_start: string
        }
        Returns: Json
      }
      read_kitchen_order_projection: {
        Args: { p_after?: string; p_restaurant_id: string }
        Returns: Json
      }
      read_legacy_add_on_candidates: { Args: never; Returns: Json }
      read_legacy_add_on_transitions: { Args: never; Returns: Json }
      read_organization_restaurant_access: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_owner_restaurant_onboarding: { Args: never; Returns: Json }
      read_platform_admin_error_overview: {
        Args: {
          p_app?: string
          p_limit?: number
          p_severity?: string
          p_window?: string
        }
        Returns: Json
      }
      read_platform_admin_identity: {
        Args: { p_user_id: string }
        Returns: Json
      }
      read_platform_admin_impersonation_session: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_session_id: string
        }
        Returns: Json
      }
      read_platform_admin_tenant: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_platform_admin_tenant_billing_timeline: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_limit?: number
          p_restaurant_id: string
        }
        Returns: Json
      }
      read_platform_admin_tenant_billing_timeline_before_refund_acces: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_limit?: number
          p_restaurant_id: string
        }
        Returns: Json
      }
      read_platform_admin_tenant_feature_overrides: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      read_platform_admin_tenant_privacy_operations: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      read_platform_admin_tenant_service_control: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_public_menu_translations: {
        Args: { p_restaurant: string }
        Returns: Json
      }
      read_public_restaurant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          timezone: string
        }[]
      }
      read_restaurant_entitlement_context: {
        Args: { p_feature: string; p_restaurant_id: string }
        Returns: Json
      }
      read_restaurant_entitlement_context_before_lifetime: {
        Args: { p_feature: string; p_restaurant_id: string }
        Returns: Json
      }
      read_restaurant_entitlement_contexts: {
        Args: { p_features: string[]; p_restaurant_id: string }
        Returns: Json
      }
      read_restaurant_subscription_add_ons: {
        Args: { p_restaurant_id: string }
        Returns: string[]
      }
      read_session_settlement_bundle: {
        Args: {
          p_actor_user_id: string
          p_restaurant_id: string
          p_session_id: string
        }
        Returns: Json
      }
      read_subscription_billing_settings: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_add_on_lifecycle: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_checkout_recovery: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_fiscal_document_proje: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_pending_projection: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_provider_cutoff: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_refund_access_cancell: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_billing_settings_before_refund_ledger: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      read_subscription_invoice_document: {
        Args: { p_invoice_id: string; p_restaurant_id: string }
        Returns: Json
      }
      read_tables_command_access_bundle: {
        Args: { p_actor_user_id: string; p_restaurant_id: string }
        Returns: Json
      }
      read_tenant_order_ingress_status: {
        Args: { p_restaurant_id: string }
        Returns: string
      }
      read_transferable_session_orders_bundle: {
        Args: {
          p_actor_user_id: string
          p_restaurant_id: string
          p_session_id: string
        }
        Returns: Json
      }
      reconcile_order_loyalty_after_earn: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      record_accounting_invoice_email_delivery: {
        Args: { p_job_id: string; p_provider_message_id: string }
        Returns: boolean
      }
      record_add_on_chargeback: {
        Args: {
          p_actor_user_id: string
          p_evidence_ref: string
          p_finalized_at: string
          p_payment_id: string
          p_purchase_id: string
        }
        Returns: undefined
      }
      record_add_on_transition: {
        Args: {
          p_error_code: string
          p_status: string
          p_subscription_id: string
          p_target_plan_ref: string
        }
        Returns: undefined
      }
      record_customer_consent_event: {
        Args: {
          p_consent_type: string
          p_customer_id: string
          p_grant: boolean
          p_lawful_basis: string
          p_policy_version: string
          p_restaurant_id: string
          p_source: string
          p_text_digest: string
        }
        Returns: boolean
      }
      record_customer_membership_legal_evidence: {
        Args: {
          p_document_version: string
          p_ip_hash: string
          p_occurred_at: string
          p_restaurant_id?: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_legal_document_acceptance: {
        Args: {
          p_document_context?: Json
          p_document_type: string
          p_document_version: string
          p_evidence_key?: string
          p_ip_hash: string
          p_occurred_at: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_manual_order_refund: {
        Args: {
          p_actor_user_id: string
          p_amount: number
          p_idempotency_key: string
          p_order_id: string
          p_reason: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      record_platform_error_event: {
        Args: {
          p_app: string
          p_occurred_at?: string
          p_public_code: string
          p_reference_id?: string
          p_restaurant_id: string
          p_severity: string
          p_source: string
        }
        Returns: string
      }
      record_resend_campaign_event: {
        Args: {
          p_event_type: string
          p_occurred_at: string
          p_provider_message_id: string
          p_webhook_id: string
        }
        Returns: boolean
      }
      record_resend_notification_event: {
        Args: {
          p_event_type: string
          p_occurred_at: string
          p_provider_message_id: string
          p_webhook_id: string
        }
        Returns: boolean
      }
      record_signup_legal_evidence: {
        Args: {
          p_document_version: string
          p_ip_hash: string
          p_occurred_at: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: boolean
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
      record_subscription_payment_success_with_plan_change_atomic: {
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
      register_customer_auth_intent: {
        Args: {
          p_context_hash: string
          p_expires_at: string
          p_flow: string
          p_nonce_hash: string
        }
        Returns: boolean
      }
      release_order_checkout_reservation: {
        Args: {
          p_order_id: string
          p_reservation_id: string
          p_restaurant_id: string
        }
        Returns: boolean
      }
      release_order_coupon_redemption: {
        Args: { p_order: string; p_reason: string }
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
      replace_menu_item_recommendations: {
        Args: {
          p_recommended_item_ids: string[]
          p_restaurant_id: string
          p_source_item_id: string
        }
        Returns: undefined
      }
      request_customer_account_deletion: {
        Args: {
          p_confirmation: string
          p_customer_id: string
          p_request_id: string
        }
        Returns: Json
      }
      request_platform_admin_tenant_plan_transition: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_plan: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      request_tenant_privacy_operation: {
        Args: {
          p_actor_user_id: string
          p_operation_type: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      requeue_domain_outbox: {
        Args: { p_event_id: string; p_operator: string }
        Returns: boolean
      }
      reschedule_subscription_checkout_recovery: {
        Args: {
          p_next_at: string
          p_operation_id: string
          p_reason: string
          p_worker: string
        }
        Returns: boolean
      }
      reserve_iyzico_order_refund: {
        Args: {
          p_actor_user_id: string
          p_amount: number
          p_idempotency_key: string
          p_order_id: string
          p_reason: string
          p_restaurant_id: string
        }
        Returns: Json
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
      resolve_guest_transfer: {
        Args: {
          p_guest_session_id: string
          p_restaurant_id: string
          p_source_table_id: string
        }
        Returns: string
      }
      resolve_payment_reconciliation: {
        Args: { p_event_id: string; p_worker: string }
        Returns: boolean
      }
      resolve_platform_subscription_refund_reconciliation: {
        Args: {
          p_amount_minor: number
          p_occurred_at?: string
          p_operation_id: string
          p_provider_payment_id: string
          p_provider_refund_ref: string
          p_provider_refunded_at: string
          p_refund_id: string
          p_verification_note: string
          p_worker: string
        }
        Returns: Json
      }
      resolve_subscription_cancellation_target_reconciliation: {
        Args: {
          p_cancellation_request_id: string
          p_cancellation_target_id: string
          p_occurred_at?: string
          p_operation_id: string
          p_provider_cancelled_at: string
          p_verification_note: string
          p_worker: string
        }
        Returns: Json
      }
      resolve_subscription_cancellation_target_terminal: {
        Args: {
          p_cancellation_request_id: string
          p_cancellation_target_id: string
          p_occurred_at?: string
          p_operation_id: string
          p_provider_observed_at: string
          p_provider_terminal_status: string
          p_verification_note: string
          p_worker: string
        }
        Returns: Json
      }
      restaurant_table_layout_snapshot: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      reveal_platform_admin_tenant_accounts: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      rotate_table_qr_token: {
        Args: {
          p_reason?: string
          p_request_id: string
          p_restaurant_id: string
          p_revoked_by?: string
          p_table_id: string
        }
        Returns: string
      }
      save_payment_credential_vault: {
        Args: {
          p_actor_user_id: string
          p_api_key_last4: string
          p_encrypted_payload: Json
          p_key_version: string
          p_mode: string
          p_operation: string
          p_payload_fingerprint: string
          p_provider: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      save_restaurant_coupon_atomic: {
        Args: { p_input: Json; p_request_id: string; p_restaurant: string }
        Returns: Json
      }
      save_restaurant_onboarding_draft: {
        Args: {
          p_draft: Json
          p_expected_revision: number
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      save_restaurant_table_layout: {
        Args: {
          p_actor_id: string
          p_entries: Json
          p_expected_revision: number
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      save_theme_draft_atomic: {
        Args: {
          p_expected_revision: number
          p_request_fingerprint: string
          p_request_id: string
          p_restaurant_id: string
          p_saved_by: string
          p_template_id: string
          p_tokens: Json
        }
        Returns: Json
      }
      schedule_subscription_cancellation: {
        Args: {
          p_idempotency_key: string
          p_occurred_at?: string
          p_request_fingerprint: string
          p_requested_by: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      set_add_on_price: {
        Args: {
          p_active: boolean
          p_actor_user_id: string
          p_add_on: string
          p_expected_version: number
          p_net_amount_minor: number
          p_vat_rate: number
        }
        Returns: undefined
      }
      set_menu_items_availability: {
        Args: {
          p_is_available: boolean
          p_item_ids: string[]
          p_restaurant_id: string
        }
        Returns: undefined
      }
      set_platform_admin_tenant_plan: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_plan: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      set_platform_admin_tenant_service_status: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
          p_status: string
        }
        Returns: Json
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
      settle_session_and_close_atomic: {
        Args: {
          p_actor_user_id: string
          p_restaurant_id: string
          p_session_id: string
          p_settlements: Json
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_table_atomic: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      start_platform_admin_impersonation_session: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_duration_minutes: number
          p_reason: string
          p_request_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      sweep_fully_paid_idle_sessions: {
        Args: { p_idle_minutes?: number }
        Returns: number
      }
      table_transfer_financial_fingerprint: {
        Args: { p_operation_id: string }
        Returns: string
      }
      table_transfer_item_order_fingerprint: {
        Args: { p_order_id: string }
        Returns: string
      }
      table_transfer_item_request_intent: {
        Args: {
          p_selections: Json
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
      }
      table_transfer_request_intent: {
        Args: {
          p_kind: string
          p_order_ids: string[]
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
      }
      transfer_table_order_items: {
        Args: {
          p_actor_id: string
          p_request_id: string
          p_restaurant_id: string
          p_selections: Json
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
      }
      transfer_table_order_items_before_inventory: {
        Args: {
          p_actor_id: string
          p_request_id: string
          p_restaurant_id: string
          p_selections: Json
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
      }
      transfer_table_orders: {
        Args: {
          p_actor_id: string
          p_order_ids: string[]
          p_request_id: string
          p_restaurant_id: string
          p_source_table_id: string
          p_target_table_id: string
        }
        Returns: Json
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
      undo_table_transfer: {
        Args: {
          p_actor_id: string
          p_operation_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      undo_table_transfer_before_inventory: {
        Args: {
          p_actor_id: string
          p_operation_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      update_restaurant_timezone_cas: {
        Args: {
          p_actor_user_id: string
          p_expected_timezone: string
          p_request_id: string
          p_restaurant_id: string
          p_timezone: string
        }
        Returns: Json
      }
      upsert_subscription_billing_profile: {
        Args: {
          p_billing_address: Json
          p_contact_email: string
          p_contact_name: string
          p_contact_surname: string
          p_gsm_number: string
          p_identity_number: string
          p_legal_name: string
          p_restaurant_id: string
          p_shipping_address: Json
        }
        Returns: Json
      }
      verify_dashboard_device_challenge: {
        Args: {
          p_code_hash: string
          p_country: string
          p_device_hash: string
          p_id: string
          p_ip_hash: string
          p_session_id: string
          p_trust: boolean
          p_user_agent_hash: string
          p_user_id: string
        }
        Returns: string
      }
      void_unstarted_split_share_atomic: {
        Args: { p_restaurant_id: string; p_share_id: string }
        Returns: string
      }
      void_verified_failed_split_share_atomic: {
        Args: {
          p_provider_token_hash: string
          p_restaurant_id: string
          p_share_id: string
        }
        Returns: string
      }
      withdraw_subscription_cancellation: {
        Args: {
          p_cancellation_request_id: string
          p_idempotency_key: string
          p_occurred_at?: string
          p_request_fingerprint: string
          p_restaurant_id: string
          p_withdrawn_by: string
        }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
