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
      activity_log: {
        Row: {
          actor_id: string | null
          affiliate_id: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          new_value: string | null
          old_value: string | null
          summary: string
        }
        Insert: {
          actor_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          summary: string
        }
        Update: {
          actor_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "activity_log_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_pct: number | null
          contact_person: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          external_ref: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          type: Database["public"]["Enums"]["affiliate_type"]
          updated_at: string
        }
        Insert: {
          commission_pct?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["affiliate_type"]
          updated_at?: string
        }
        Update: {
          commission_pct?: number | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["affiliate_type"]
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_rm: boolean
          last_pipeline_view: Database["public"]["Enums"]["pipeline_view"]
          prefs: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_rm?: boolean
          last_pipeline_view?: Database["public"]["Enums"]["pipeline_view"]
          prefs?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_rm?: boolean
          last_pipeline_view?: Database["public"]["Enums"]["pipeline_view"]
          prefs?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          app_user_id: string | null
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          full_name: string | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          app_user_id?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          app_user_id?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brokers_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          body_tsv: unknown
          created_at: string
          deleted_at: string | null
          id: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          body_tsv?: unknown
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          body_tsv?: unknown
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          filename: string
          id: string
          lead_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          filename: string
          id?: string
          lead_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          filename?: string
          id?: string
          lead_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      generators: {
        Row: {
          affiliate_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          full_name: string | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          error_report: Json | null
          error_rows: number | null
          filename: string
          id: string
          status: string
          total_rows: number | null
          updated_at: string
          uploaded_by: string
          valid_rows: number | null
        }
        Insert: {
          created_at?: string
          error_report?: Json | null
          error_rows?: number | null
          filename: string
          id?: string
          status?: string
          total_rows?: number | null
          updated_at?: string
          uploaded_by: string
          valid_rows?: number | null
        }
        Update: {
          created_at?: string
          error_report?: Json | null
          error_rows?: number | null
          filename?: string
          id?: string
          status?: string
          total_rows?: number | null
          updated_at?: string
          uploaded_by?: string
          valid_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_products: {
        Row: {
          created_at: string
          lead_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          lead_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          lead_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          id: string
          kind: Database["public"]["Enums"]["transition_kind"]
          lead_id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          kind: Database["public"]["Enums"]["transition_kind"]
          lead_id: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          kind?: Database["public"]["Enums"]["transition_kind"]
          lead_id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          kind: Database["public"]["Enums"]["transition_kind"]
          lead_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          kind: Database["public"]["Enums"]["transition_kind"]
          lead_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          kind?: Database["public"]["Enums"]["transition_kind"]
          lead_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          affiliate_id: string
          anonymized_at: string | null
          application_date: string | null
          broker_id: string | null
          country_of_residence: string | null
          created_at: string
          customer_name: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          generator_id: string | null
          id: string
          import_job_id: string | null
          last_name: string
          lead_code: string
          lead_state: Database["public"]["Enums"]["lead_state"]
          lost_at: string | null
          lost_by: string | null
          lost_notes: string | null
          lost_reason_id: string | null
          nationality: string | null
          notes: string | null
          opportunity: Database["public"]["Enums"]["opportunity_status"]
          payment_date: string | null
          phone: string | null
          phone_normalized: string | null
          policy_number: string | null
          qualification: Database["public"]["Enums"]["qualification_status"]
          qualified_at: string | null
          quote_date: string | null
          search_tsv: unknown
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string
          title: string | null
          updated_at: string
          whatsapp_normalized: string | null
          whatsapp_phone: string | null
          whatsapp_same_as_phone: boolean
        }
        Insert: {
          affiliate_id: string
          anonymized_at?: string | null
          application_date?: string | null
          broker_id?: string | null
          country_of_residence?: string | null
          created_at?: string
          customer_name: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          generator_id?: string | null
          id?: string
          import_job_id?: string | null
          last_name: string
          lead_code?: string
          lead_state?: Database["public"]["Enums"]["lead_state"]
          lost_at?: string | null
          lost_by?: string | null
          lost_notes?: string | null
          lost_reason_id?: string | null
          nationality?: string | null
          notes?: string | null
          opportunity?: Database["public"]["Enums"]["opportunity_status"]
          payment_date?: string | null
          phone?: string | null
          phone_normalized?: string | null
          policy_number?: string | null
          qualification?: Database["public"]["Enums"]["qualification_status"]
          qualified_at?: string | null
          quote_date?: string | null
          search_tsv?: unknown
          source_channel?: Database["public"]["Enums"]["source_channel"]
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string
          title?: string | null
          updated_at?: string
          whatsapp_normalized?: string | null
          whatsapp_phone?: string | null
          whatsapp_same_as_phone?: boolean
        }
        Update: {
          affiliate_id?: string
          anonymized_at?: string | null
          application_date?: string | null
          broker_id?: string | null
          country_of_residence?: string | null
          created_at?: string
          customer_name?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          generator_id?: string | null
          id?: string
          import_job_id?: string | null
          last_name?: string
          lead_code?: string
          lead_state?: Database["public"]["Enums"]["lead_state"]
          lost_at?: string | null
          lost_by?: string | null
          lost_notes?: string | null
          lost_reason_id?: string | null
          nationality?: string | null
          notes?: string | null
          opportunity?: Database["public"]["Enums"]["opportunity_status"]
          payment_date?: string | null
          phone?: string | null
          phone_normalized?: string | null
          policy_number?: string | null
          qualification?: Database["public"]["Enums"]["qualification_status"]
          qualified_at?: string | null
          quote_date?: string | null
          search_tsv?: unknown
          source_channel?: Database["public"]["Enums"]["source_channel"]
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string
          title?: string | null
          updated_at?: string
          whatsapp_normalized?: string | null
          whatsapp_phone?: string | null
          whatsapp_same_as_phone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "v_broker_stats"
            referencedColumns: ["broker_id"]
          },
          {
            foreignKeyName: "leads_generator_id_fkey"
            columns: ["generator_id"]
            isOneToOne: false
            referencedRelation: "generators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_generator_id_fkey"
            columns: ["generator_id"]
            isOneToOne: false
            referencedRelation: "v_generator_stats"
            referencedColumns: ["generator_id"]
          },
          {
            foreignKeyName: "leads_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_by_fkey"
            columns: ["lost_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notify_assigned_rm: boolean
          rule_key: string
          target_roles: Database["public"]["Enums"]["user_role"][]
          threshold_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notify_assigned_rm?: boolean
          rule_key: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          threshold_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notify_assigned_rm?: boolean
          rule_key?: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          threshold_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          affiliate_id: string | null
          body: string | null
          created_at: string
          dedupe_key: string
          id: string
          lead_id: string | null
          read_at: string | null
          rule_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          body?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          lead_id?: string | null
          read_at?: string | null
          rule_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          body?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          lead_id?: string | null
          read_at?: string | null
          rule_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "notifications_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_affiliates: {
        Row: {
          affiliate_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_affiliates_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_affiliates_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "pinned_affiliates_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "pinned_affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          resource: string
          role: Database["public"]["Enums"]["user_role"]
          scope: string
        }
        Insert: {
          action: string
          allowed?: boolean
          resource: string
          role: Database["public"]["Enums"]["user_role"]
          scope?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          resource?: string
          role?: Database["public"]["Enums"]["user_role"]
          scope?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          query_string: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          query_string: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          query_string?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_affiliate_stats: {
        Row: {
          affiliate_id: string | null
          conversion_rate: number | null
          last_lead_at: string | null
          n_application: number | null
          n_lost: number | null
          n_negotiation: number | null
          n_not_qualified: number | null
          n_pending: number | null
          n_policy_issued: number | null
          n_qualified: number | null
          n_quote_sent: number | null
          n_renewal: number | null
          total_leads: number | null
        }
        Relationships: []
      }
      v_affiliate_commission: {
        Row: {
          affiliate_id: string | null
          commission_pct: number | null
        }
        Insert: {
          affiliate_id?: string | null
          commission_pct?: never
        }
        Update: {
          affiliate_id?: string | null
          commission_pct?: never
        }
        Relationships: []
      }
      v_broker_stats: {
        Row: {
          active_leads: number | null
          broker_id: string | null
          n_applications: number | null
          n_lost: number | null
          n_policies: number | null
          n_quotes: number | null
          n_renewals: number | null
          total_leads: number | null
        }
        Relationships: []
      }
      v_funnel_by_affiliate: {
        Row: {
          affiliate_id: string | null
          reached_application: number | null
          reached_negotiation: number | null
          reached_policy: number | null
          reached_qualified: number | null
          reached_quote_sent: number | null
          reached_renewal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      v_generator_stats: {
        Row: {
          affiliate_id: string | null
          conversion_rate: number | null
          generator_id: string | null
          n_lost: number | null
          n_policies: number | null
          n_qualified: number | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "generators_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
      v_lead_aging: {
        Row: {
          affiliate_id: string | null
          broker_id: string | null
          customer_name: string | null
          id: string | null
          lead_code: string | null
          qualification:
            | Database["public"]["Enums"]["qualification_status"]
            | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string | null
          time_in_stage: string | null
        }
        Insert: {
          affiliate_id?: string | null
          broker_id?: string | null
          customer_name?: string | null
          id?: string | null
          lead_code?: string | null
          qualification?:
            | Database["public"]["Enums"]["qualification_status"]
            | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string | null
          time_in_stage?: never
        }
        Update: {
          affiliate_id?: string | null
          broker_id?: string | null
          customer_name?: string | null
          id?: string | null
          lead_code?: string | null
          qualification?:
            | Database["public"]["Enums"]["qualification_status"]
            | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string | null
          time_in_stage?: never
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "v_broker_stats"
            referencedColumns: ["broker_id"]
          },
        ]
      }
      v_monthly_cohorts: {
        Row: {
          affiliate_id: string | null
          cohort_month: string | null
          converted: number | null
          in_progress: number | null
          lost: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "mv_affiliate_stats"
            referencedColumns: ["affiliate_id"]
          },
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_commission"
            referencedColumns: ["affiliate_id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_lead: { Args: { p_lead_id: string }; Returns: undefined }
      app_current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      change_lead_stage: {
        Args: {
          p_lead_id: string
          p_reason?: string
          p_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Returns: {
          affiliate_id: string
          anonymized_at: string | null
          application_date: string | null
          broker_id: string | null
          country_of_residence: string | null
          created_at: string
          customer_name: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          generator_id: string | null
          id: string
          import_job_id: string | null
          last_name: string
          lead_code: string
          lead_state: Database["public"]["Enums"]["lead_state"]
          lost_at: string | null
          lost_by: string | null
          lost_notes: string | null
          lost_reason_id: string | null
          nationality: string | null
          notes: string | null
          opportunity: Database["public"]["Enums"]["opportunity_status"]
          payment_date: string | null
          phone: string | null
          phone_normalized: string | null
          policy_number: string | null
          qualification: Database["public"]["Enums"]["qualification_status"]
          qualified_at: string | null
          quote_date: string | null
          search_tsv: unknown
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string
          title: string | null
          updated_at: string
          whatsapp_normalized: string | null
          whatsapp_phone: string | null
          whatsapp_same_as_phone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_user_id: { Args: never; Returns: string }
      find_duplicate_leads: {
        Args: {
          p_dob?: string
          p_email?: string
          p_exclude?: string
          p_first?: string
          p_last?: string
          p_phone?: string
          p_whatsapp?: string
        }
        Returns: {
          affiliate_name: string
          customer_name: string
          email: string
          id: string
          lead_code: string
          match_reason: string
          phone: string
        }[]
      }
      fn_scan_notifications: { Args: never; Returns: undefined }
      has_perm: {
        Args: { p_action: string; p_resource: string }
        Returns: boolean
      }
      lead_transition_kind: {
        Args: {
          p_from: Database["public"]["Enums"]["lead_status"]
          p_to: Database["public"]["Enums"]["lead_status"]
        }
        Returns: Database["public"]["Enums"]["transition_kind"]
      }
      mark_lead_lost: {
        Args: { p_lead_id: string; p_notes?: string; p_reason_id: string }
        Returns: {
          affiliate_id: string
          anonymized_at: string | null
          application_date: string | null
          broker_id: string | null
          country_of_residence: string | null
          created_at: string
          customer_name: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          generator_id: string | null
          id: string
          import_job_id: string | null
          last_name: string
          lead_code: string
          lead_state: Database["public"]["Enums"]["lead_state"]
          lost_at: string | null
          lost_by: string | null
          lost_notes: string | null
          lost_reason_id: string | null
          nationality: string | null
          notes: string | null
          opportunity: Database["public"]["Enums"]["opportunity_status"]
          payment_date: string | null
          phone: string | null
          phone_normalized: string | null
          policy_number: string | null
          qualification: Database["public"]["Enums"]["qualification_status"]
          qualified_at: string | null
          quote_date: string | null
          search_tsv: unknown
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string
          title: string | null
          updated_at: string
          whatsapp_normalized: string | null
          whatsapp_phone: string | null
          whatsapp_same_as_phone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_lead: { Args: { p_lead_id: string }; Returns: boolean }
      perm_scope: {
        Args: { p_action: string; p_resource: string }
        Returns: string
      }
      reopen_lead: {
        Args: {
          p_lead_id: string
          p_reason?: string
          p_stage?: Database["public"]["Enums"]["pipeline_stage"]
        }
        Returns: {
          affiliate_id: string
          anonymized_at: string | null
          application_date: string | null
          broker_id: string | null
          country_of_residence: string | null
          created_at: string
          customer_name: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          generator_id: string | null
          id: string
          import_job_id: string | null
          last_name: string
          lead_code: string
          lead_state: Database["public"]["Enums"]["lead_state"]
          lost_at: string | null
          lost_by: string | null
          lost_notes: string | null
          lost_reason_id: string | null
          nationality: string | null
          notes: string | null
          opportunity: Database["public"]["Enums"]["opportunity_status"]
          payment_date: string | null
          phone: string | null
          phone_normalized: string | null
          policy_number: string | null
          qualification: Database["public"]["Enums"]["qualification_status"]
          qualified_at: string | null
          quote_date: string | null
          search_tsv: unknown
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string
          title: string | null
          updated_at: string
          whatsapp_normalized: string | null
          whatsapp_phone: string | null
          whatsapp_same_as_phone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_lead_qualification: {
        Args: {
          p_lead_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["qualification_status"]
        }
        Returns: {
          affiliate_id: string
          anonymized_at: string | null
          application_date: string | null
          broker_id: string | null
          country_of_residence: string | null
          created_at: string
          customer_name: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          generator_id: string | null
          id: string
          import_job_id: string | null
          last_name: string
          lead_code: string
          lead_state: Database["public"]["Enums"]["lead_state"]
          lost_at: string | null
          lost_by: string | null
          lost_notes: string | null
          lost_reason_id: string | null
          nationality: string | null
          notes: string | null
          opportunity: Database["public"]["Enums"]["opportunity_status"]
          payment_date: string | null
          phone: string | null
          phone_normalized: string | null
          policy_number: string | null
          qualification: Database["public"]["Enums"]["qualification_status"]
          qualified_at: string | null
          quote_date: string | null
          search_tsv: unknown
          source_channel: Database["public"]["Enums"]["source_channel"]
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_at_loss: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string
          title: string | null
          updated_at: string
          whatsapp_normalized: string | null
          whatsapp_phone: string | null
          whatsapp_same_as_phone: boolean
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      stage_rank:
        | {
            Args: { s: Database["public"]["Enums"]["lead_status"] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.stage_rank(s => lead_status), public.stage_rank(s => pipeline_stage). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { s: Database["public"]["Enums"]["pipeline_stage"] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.stage_rank(s => lead_status), public.stage_rank(s => pipeline_stage). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      affiliate_type:
        | "relocation_agency"
        | "expat_services"
        | "referral_partner"
        | "financial_advisor"
        | "other"
        | "affiliate"
        | "website"
        | "paid_advertising"
        | "direct"
        | "broker"
      lead_state: "new" | "active" | "closed"
      lead_status:
        | "inbound"
        | "contacted"
        | "opportunity_open"
        | "account_pending"
        | "account_open"
        | "account_lapsed"
        | "lost"
      lost_reason:
        | "declined_quote"
        | "too_expensive"
        | "bought_elsewhere"
        | "unresponsive"
        | "disqualified_medical"
        | "disqualified_eligibility"
        | "duplicate"
        | "invalid_contact"
        | "other"
      opportunity_status: "active" | "lost"
      pipeline_stage:
        | "qualified"
        | "quote_sent"
        | "negotiation"
        | "application_received"
        | "policy_issued"
        | "renewal"
      pipeline_view: "kanban" | "table"
      qualification_status: "pending" | "qualified" | "not_qualified"
      source_channel: "manual" | "csv" | "api"
      transition_kind:
        | "progress"
        | "correction"
        | "reopen"
        | "lapse"
        | "reinstate"
        | "import"
        | "qualify"
        | "disqualify"
        | "lost"
      user_role: "admin" | "business_development" | "rm_staff" | "read_only"
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
    Enums: {
      affiliate_type: [
        "relocation_agency",
        "expat_services",
        "referral_partner",
        "financial_advisor",
        "other",
        "affiliate",
        "website",
        "paid_advertising",
        "direct",
        "broker",
      ],
      lead_state: ["new", "active", "closed"],
      lead_status: [
        "inbound",
        "contacted",
        "opportunity_open",
        "account_pending",
        "account_open",
        "account_lapsed",
        "lost",
      ],
      lost_reason: [
        "declined_quote",
        "too_expensive",
        "bought_elsewhere",
        "unresponsive",
        "disqualified_medical",
        "disqualified_eligibility",
        "duplicate",
        "invalid_contact",
        "other",
      ],
      opportunity_status: ["active", "lost"],
      pipeline_stage: [
        "qualified",
        "quote_sent",
        "negotiation",
        "application_received",
        "policy_issued",
        "renewal",
      ],
      pipeline_view: ["kanban", "table"],
      qualification_status: ["pending", "qualified", "not_qualified"],
      source_channel: ["manual", "csv", "api"],
      transition_kind: [
        "progress",
        "correction",
        "reopen",
        "lapse",
        "reinstate",
        "import",
        "qualify",
        "disqualify",
        "lost",
      ],
      user_role: ["admin", "business_development", "rm_staff", "read_only"],
    },
  },
} as const
