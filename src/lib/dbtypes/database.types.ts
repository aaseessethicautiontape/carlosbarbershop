export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      barber_services: {
        Row: {
          barber_id: string
          service_id: string
        }
        Insert: {
          barber_id: string
          service_id: string
        }
        Update: {
          barber_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          initials: string
          is_published: boolean
          name: string
          on_duty: boolean
          photo_path: string | null
          shop_id: string
          sort_order: number
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          initials: string
          is_published?: boolean
          name: string
          on_duty?: boolean
          photo_path?: string | null
          shop_id: string
          sort_order?: number
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          initials?: string
          is_published?: boolean
          name?: string
          on_duty?: boolean
          photo_path?: string | null
          shop_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "barbers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          barber_id: string
          cancelled_at: string | null
          client_id: string
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          price_cents_snapshot: number | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          service_id: string
          shop_id: string
          source: Database["public"]["Enums"]["booking_source"]
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          barber_id: string
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          price_cents_snapshot?: number | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          service_id: string
          shop_id: string
          source?: Database["public"]["Enums"]["booking_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          barber_id?: string
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents_snapshot?: number | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          service_id?: string
          shop_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      busy_blocks: {
        Row: {
          barber_id: string
          during: unknown
          id: string
          kind: string
          shop_id: string
        }
        Insert: {
          barber_id: string
          during: unknown
          id: string
          kind: string
          shop_id: string
        }
        Update: {
          barber_id?: string
          during?: unknown
          id?: string
          kind?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "busy_blocks_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busy_blocks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          marketing_ok: boolean
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          source: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          marketing_ok?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          marketing_ok?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_settings: {
        Row: {
          email_enabled: boolean
          shop_id: string
          sms_enabled: boolean
          template_key: string
        }
        Insert: {
          email_enabled?: boolean
          shop_id: string
          sms_enabled?: boolean
          template_key: string
        }
        Update: {
          email_enabled?: boolean
          shop_id?: string
          sms_enabled?: boolean
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          body: string
          booking_id: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          error: string | null
          id: string
          provider_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["notify_status"]
          subject: string | null
          template_key: string
          to_address: string
          walkin_id: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          shop_id: string
          status: Database["public"]["Enums"]["notify_status"]
          subject?: string | null
          template_key: string
          to_address: string
          walkin_id?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["notify_status"]
          subject?: string | null
          template_key?: string
          to_address?: string
          walkin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_walkin_id_fkey"
            columns: ["walkin_id"]
            isOneToOne: false
            referencedRelation: "walkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_walkin_id_fkey"
            columns: ["walkin_id"]
            isOneToOne: false
            referencedRelation: "walkins_ranked"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          barber_id: string | null
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barber_fk"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_state: {
        Row: {
          avg_minutes: number
          est_wait_min: number | null
          free_chairs: number
          on_duty_count: number
          shop_id: string
          updated_at: string
          waiting_count: number
        }
        Insert: {
          avg_minutes?: number
          est_wait_min?: number | null
          free_chairs?: number
          on_duty_count?: number
          shop_id: string
          updated_at?: string
          waiting_count?: number
        }
        Update: {
          avg_minutes?: number
          est_wait_min?: number | null
          free_chairs?: number
          on_duty_count?: number
          shop_id?: string
          updated_at?: string
          waiting_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "queue_state_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_label: string | null
          duration_minutes: number
          id: string
          name: string
          price_cents: number | null
          shop_id: string
          show_online: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_label?: string | null
          duration_minutes: number
          id?: string
          name: string
          price_cents?: number | null
          shop_id: string
          show_online?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_label?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number | null
          shop_id?: string
          show_online?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string
          avg_walkin_minutes: number
          booking_window_days: number
          city: string
          created_at: string
          id: string
          max_queue: number
          min_lead_minutes: number
          name: string
          phone: string | null
          postal_code: string | null
          public_email: string | null
          region: string
          slot_step_minutes: number
          timezone: string
          walkin_requires_open: boolean
        }
        Insert: {
          address: string
          avg_walkin_minutes?: number
          booking_window_days?: number
          city: string
          created_at?: string
          id?: string
          max_queue?: number
          min_lead_minutes?: number
          name: string
          phone?: string | null
          postal_code?: string | null
          public_email?: string | null
          region?: string
          slot_step_minutes?: number
          timezone?: string
          walkin_requires_open?: boolean
        }
        Update: {
          address?: string
          avg_walkin_minutes?: number
          booking_window_days?: number
          city?: string
          created_at?: string
          id?: string
          max_queue?: number
          min_lead_minutes?: number
          name?: string
          phone?: string | null
          postal_code?: string | null
          public_email?: string | null
          region?: string
          slot_step_minutes?: number
          timezone?: string
          walkin_requires_open?: boolean
        }
        Relationships: []
      }
      time_off: {
        Row: {
          barber_id: string
          ends_at: string
          id: string
          reason: string | null
          shop_id: string
          starts_at: string
        }
        Insert: {
          barber_id: string
          ends_at: string
          id?: string
          reason?: string | null
          shop_id: string
          starts_at: string
        }
        Update: {
          barber_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          shop_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      walkins: {
        Row: {
          client_id: string | null
          created_at: string
          display_name: string
          id: string
          joined_at: string
          notified_next_at: string | null
          phone: string | null
          seated_at: string | null
          seated_barber_id: string | null
          service_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["walkin_status"]
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          joined_at?: string
          notified_next_at?: string | null
          phone?: string | null
          seated_at?: string | null
          seated_barber_id?: string | null
          service_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["walkin_status"]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          joined_at?: string
          notified_next_at?: string | null
          phone?: string | null
          seated_at?: string | null
          seated_barber_id?: string | null
          service_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["walkin_status"]
        }
        Relationships: [
          {
            foreignKeyName: "walkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_seated_barber_id_fkey"
            columns: ["seated_barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          barber_id: string | null
          closes: string
          id: string
          is_off: boolean
          opens: string
          shop_id: string
          weekday: number
        }
        Insert: {
          barber_id?: string | null
          closes: string
          id?: string
          is_off?: boolean
          opens: string
          shop_id: string
          weekday: number
        }
        Update: {
          barber_id?: string | null
          closes?: string
          id?: string
          is_off?: boolean
          opens?: string
          shop_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      walkins_ranked: {
        Row: {
          client_id: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          joined_at: string | null
          notified_next_at: string | null
          phone: string | null
          position: number | null
          seated_at: string | null
          seated_barber_id: string | null
          service_id: string | null
          shop_id: string | null
          status: Database["public"]["Enums"]["walkin_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "walkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_seated_barber_id_fkey"
            columns: ["seated_barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkins_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_booking: {
        Args: {
          p_barber: string
          p_email?: string
          p_name: string
          p_notes?: string
          p_phone: string
          p_service: string
          p_shop: string
          p_source?: Database["public"]["Enums"]["booking_source"]
          p_starts: string
        }
        Returns: string
      }
      demo_fill_day: {
        Args: { p_day: string; p_shop: string }
        Returns: number
      }
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      join_walkin: {
        Args: {
          p_name: string
          p_phone: string
          p_service?: string
          p_shop: string
        }
        Returns: string
      }
      reschedule_booking: {
        Args: { p_barber?: string; p_booking: string; p_starts: string }
        Returns: undefined
      }
      seat_walkin: {
        Args: { p_barber: string; p_walkin: string }
        Returns: string
      }
      walkin_status: {
        Args: { p_walkin: string }
        Returns: {
          est_wait_min: number
          first_name: string
          queue_position: number
          status: Database["public"]["Enums"]["walkin_status"]
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "barber"
      booking_source: "web" | "admin" | "walk_in"
      booking_status: "booked" | "in_chair" | "done" | "no_show" | "cancelled"
      notify_channel: "email" | "sms"
      notify_status: "logged" | "sent" | "failed"
      walkin_status: "waiting" | "seated" | "removed" | "left"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "barber"],
      booking_source: ["web", "admin", "walk_in"],
      booking_status: ["booked", "in_chair", "done", "no_show", "cancelled"],
      notify_channel: ["email", "sms"],
      notify_status: ["logged", "sent", "failed"],
      walkin_status: ["waiting", "seated", "removed", "left"],
    },
  },
} as const

