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
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          error: string | null
          id: string
          phone: string
          provider_message_id: string | null
          restaurant_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          phone: string
          provider_message_id?: string | null
          restaurant_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
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
          carb_g: number | null
          category_id: string
          contains_alcohol: boolean
          contains_allergens: string[]
          contains_pork: boolean
          cost: number | null
          created_at: string
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
          carb_g?: number | null
          category_id: string
          contains_alcohol?: boolean
          contains_allergens?: string[]
          contains_pork?: boolean
          cost?: number | null
          created_at?: string
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
          carb_g?: number | null
          category_id?: string
          contains_alcohol?: boolean
          contains_allergens?: string[]
          contains_pork?: boolean
          cost?: number | null
          created_at?: string
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
          created_at: string
          customer_id: string | null
          customer_tier: Json | null
          deleted_at: string | null
          id: string
          items: Json
          paid_at: string | null
          payment_method: string | null
          ready_at: string | null
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
          created_at?: string
          customer_id?: string | null
          customer_tier?: Json | null
          deleted_at?: string | null
          id?: string
          items?: Json
          paid_at?: string | null
          payment_method?: string | null
          ready_at?: string | null
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
          created_at?: string
          customer_id?: string | null
          customer_tier?: Json | null
          deleted_at?: string | null
          id?: string
          items?: Json
          paid_at?: string | null
          payment_method?: string | null
          ready_at?: string | null
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
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
        }
        Relationships: []
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
          restaurant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          restaurant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
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
      theme_configs: {
        Row: {
          component_overrides: Json
          created_at: string
          id: string
          restaurant_id: string
          tokens: Json
          updated_at: string
        }
        Insert: {
          component_overrides?: Json
          created_at?: string
          id?: string
          restaurant_id: string
          tokens?: Json
          updated_at?: string
        }
        Update: {
          component_overrides?: Json
          created_at?: string
          id?: string
          restaurant_id?: string
          tokens?: Json
          updated_at?: string
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
      customer_access_token_hook: { Args: { event: Json }; Returns: Json }
      finalize_split_if_covered: {
        Args: { p_session_id: string }
        Returns: boolean
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
      is_restaurant_owner: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      is_staff_user: { Args: { p_user_id: string }; Returns: boolean }
      menu_category_restaurant: {
        Args: { p_category_id: string }
        Returns: string
      }
      open_or_get_table_session: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sweep_fully_paid_idle_sessions: {
        Args: { p_idle_minutes?: number }
        Returns: number
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
