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
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          accountant_email: string
          admin_new_request_email_enabled: boolean
          clauses_1341_1342_version: string
          completion_window_hours: number
          current_invoice_year: number
          health_consent_version: string
          id: number
          image_use_consent_version: string
          next_invoice_number: number
          payment_window_hours: number
          privacy_version: string
          requester_receipt_email_enabled: boolean
          review_email_enabled: boolean
          review_url: string | null
          terms_version: string
          updated_at: string
          xml_export_cron_enabled: boolean
          xml_export_last_run_at: string | null
        }
        Insert: {
          accountant_email: string
          admin_new_request_email_enabled?: boolean
          clauses_1341_1342_version: string
          completion_window_hours?: number
          current_invoice_year?: number
          health_consent_version: string
          id: number
          image_use_consent_version: string
          next_invoice_number?: number
          payment_window_hours?: number
          privacy_version: string
          requester_receipt_email_enabled?: boolean
          review_email_enabled?: boolean
          review_url?: string | null
          terms_version: string
          updated_at?: string
          xml_export_cron_enabled?: boolean
          xml_export_last_run_at?: string | null
        }
        Update: {
          accountant_email?: string
          admin_new_request_email_enabled?: boolean
          clauses_1341_1342_version?: string
          completion_window_hours?: number
          current_invoice_year?: number
          health_consent_version?: string
          id?: number
          image_use_consent_version?: string
          next_invoice_number?: number
          payment_window_hours?: number
          privacy_version?: string
          requester_receipt_email_enabled?: boolean
          review_email_enabled?: boolean
          review_url?: string | null
          terms_version?: string
          updated_at?: string
          xml_export_cron_enabled?: boolean
          xml_export_last_run_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          from_state: string | null
          id: string
          metadata: Json
          reason: string | null
          to_state: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          from_state?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_state?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_state?: string | null
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          consent_health_accepted: boolean
          consent_health_accepted_at: string
          consent_health_version: string
          consent_privacy_accepted: boolean
          consent_privacy_accepted_at: string
          consent_privacy_version: string
          consent_submitted_at: string
          consent_terms_accepted: boolean
          consent_terms_accepted_at: string
          consent_terms_version: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          decision_share_with_requester: boolean
          dietary_notes: string | null
          event_id: string
          id: string
          ip_address: unknown
          notes: string | null
          people: number
          requester_email: string
          requester_first_name: string
          requester_last_name: string
          requester_phone: string
          source: string
          special_occasion: string | null
          status: string
          submitted_at: string
          user_agent: string
        }
        Insert: {
          consent_health_accepted?: boolean
          consent_health_accepted_at: string
          consent_health_version: string
          consent_privacy_accepted?: boolean
          consent_privacy_accepted_at: string
          consent_privacy_version: string
          consent_submitted_at: string
          consent_terms_accepted?: boolean
          consent_terms_accepted_at: string
          consent_terms_version: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          decision_share_with_requester?: boolean
          dietary_notes?: string | null
          event_id: string
          id?: string
          ip_address: unknown
          notes?: string | null
          people: number
          requester_email: string
          requester_first_name: string
          requester_last_name: string
          requester_phone: string
          source?: string
          special_occasion?: string | null
          status?: string
          submitted_at?: string
          user_agent: string
        }
        Update: {
          consent_health_accepted?: boolean
          consent_health_accepted_at?: string
          consent_health_version?: string
          consent_privacy_accepted?: boolean
          consent_privacy_accepted_at?: string
          consent_privacy_version?: string
          consent_submitted_at?: string
          consent_terms_accepted?: boolean
          consent_terms_accepted_at?: string
          consent_terms_version?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          decision_share_with_requester?: boolean
          dietary_notes?: string | null
          event_id?: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          people?: number
          requester_email?: string
          requester_first_name?: string
          requester_last_name?: string
          requester_phone?: string
          source?: string
          special_occasion?: string | null
          status?: string
          submitted_at?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_cents: number
          amount_paid_cents: number | null
          cancellation_affects_review_email: boolean
          cancelled_after_payment_at: string | null
          cancelled_after_payment_by: string | null
          cancelled_after_payment_reason: string | null
          completion_deadline_at: string
          completion_token_hash: string
          completion_token_issued_at: string
          completion_token_last4: string | null
          completion_token_used_at: string | null
          consent_ip: unknown
          consent_user_agent: string | null
          consents: Json | null
          created_at: string
          currency: string
          dietary_notes: string | null
          event_id: string
          health_consent_accepted_at: string | null
          id: string
          image_use_choice: string | null
          legal_accepted_at: string | null
          origin: string
          paid_at: string | null
          payment_deadline_at: string | null
          people: number
          privacy_accepted_at: string | null
          request_id: string
          review_email_sent_at: string | null
          revision: number
          special_occasion: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_cents: number
          amount_paid_cents?: number | null
          cancellation_affects_review_email?: boolean
          cancelled_after_payment_at?: string | null
          cancelled_after_payment_by?: string | null
          cancelled_after_payment_reason?: string | null
          completion_deadline_at: string
          completion_token_hash: string
          completion_token_issued_at: string
          completion_token_last4?: string | null
          completion_token_used_at?: string | null
          consent_ip?: unknown
          consent_user_agent?: string | null
          consents?: Json | null
          created_at?: string
          currency?: string
          dietary_notes?: string | null
          event_id: string
          health_consent_accepted_at?: string | null
          id?: string
          image_use_choice?: string | null
          legal_accepted_at?: string | null
          origin?: string
          paid_at?: string | null
          payment_deadline_at?: string | null
          people: number
          privacy_accepted_at?: string | null
          request_id: string
          review_email_sent_at?: string | null
          revision?: number
          special_occasion?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          amount_paid_cents?: number | null
          cancellation_affects_review_email?: boolean
          cancelled_after_payment_at?: string | null
          cancelled_after_payment_by?: string | null
          cancelled_after_payment_reason?: string | null
          completion_deadline_at?: string
          completion_token_hash?: string
          completion_token_issued_at?: string
          completion_token_last4?: string | null
          completion_token_used_at?: string | null
          consent_ip?: unknown
          consent_user_agent?: string | null
          consents?: Json | null
          created_at?: string
          currency?: string
          dietary_notes?: string | null
          event_id?: string
          health_consent_accepted_at?: string | null
          id?: string
          image_use_choice?: string | null
          legal_accepted_at?: string | null
          origin?: string
          paid_at?: string | null
          payment_deadline_at?: string | null
          people?: number
          privacy_accepted_at?: string | null
          request_id?: string
          review_email_sent_at?: string | null
          revision?: number
          special_occasion?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_after_payment_by_fkey"
            columns: ["cancelled_after_payment_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          email_id: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          idempotency_key: string
          recipient_email: string
          resend_message_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email_id: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          recipient_email: string
          resend_message_id?: string | null
          status: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          recipient_email?: string
          resend_message_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          capacity: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          duration_min: number | null
          id: string
          price_cents: number
          slug: string
          starts_at: string
          status: string
          title: string
          updated_at: string
          vat_rate_bps: number
        }
        Insert: {
          capacity: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          price_cents: number
          slug: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          vat_rate_bps?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          price_cents?: number
          slug?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          vat_rate_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_profiles: {
        Row: {
          address_city: string
          address_country: string
          address_province: string | null
          address_street: string
          address_zip: string
          booking_id: string
          created_at: string
          first_name: string | null
          id: string
          invoice_note: string | null
          kind: string
          last_name: string | null
          legal_name: string
          pec_email: string | null
          sdi_code: string | null
          tax_code: string | null
          vat_number: string | null
        }
        Insert: {
          address_city: string
          address_country?: string
          address_province?: string | null
          address_street: string
          address_zip: string
          booking_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          invoice_note?: string | null
          kind: string
          last_name?: string | null
          legal_name: string
          pec_email?: string | null
          sdi_code?: string | null
          tax_code?: string | null
          vat_number?: string | null
        }
        Update: {
          address_city?: string
          address_country?: string
          address_province?: string | null
          address_street?: string
          address_zip?: string
          booking_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          invoice_note?: string | null
          kind?: string
          last_name?: string | null
          legal_name?: string
          pec_email?: string | null
          sdi_code?: string | null
          tax_code?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_profiles_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number | null
          booking_id: string
          currency: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          raw_event: Json
          received_at: string
          status: string
          stripe_event_id: string
          stripe_event_type: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          booking_id: string
          currency?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          raw_event: Json
          received_at?: string
          status: string
          stripe_event_id: string
          stripe_event_type: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          booking_id?: string
          currency?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          raw_event?: Json
          received_at?: string
          status?: string
          stripe_event_id?: string
          stripe_event_type?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      request_rate_limits: {
        Row: {
          bucket_key: string
          hit_count: number
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          hit_count?: number
          window_started_at?: string
        }
        Update: {
          bucket_key?: string
          hit_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      xml_export_items: {
        Row: {
          booking_id: string
          id: string
          xml_export_id: string
        }
        Insert: {
          booking_id: string
          id?: string
          xml_export_id: string
        }
        Update: {
          booking_id?: string
          id?: string
          xml_export_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xml_export_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xml_export_items_xml_export_id_fkey"
            columns: ["xml_export_id"]
            isOneToOne: false
            referencedRelation: "xml_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_exports: {
        Row: {
          created_at: string
          created_by: string | null
          email_message_id: string | null
          emailed_at: string | null
          error_message: string | null
          generated_at: string | null
          id: string
          period_end: string
          period_start: string
          recipient_email: string
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_message_id?: string | null
          emailed_at?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          period_end: string
          period_start: string
          recipient_email: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_message_id?: string | null
          emailed_at?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          recipient_email?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xml_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_bucket_key: string
          p_max_hits: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          hit_count: number
          window_started_at: string
        }[]
      }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      prune_rate_limit_buckets: {
        Args: { p_older_than_hours?: number }
        Returns: number
      }
      reserve_invoice_number: {
        Args: { target_year: number }
        Returns: {
          number: number
          year: number
        }[]
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
