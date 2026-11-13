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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      card_catalog: {
        Row: {
          category: string
          counts_toward_normal_limit: boolean
          created_at: string
          description: string
          disposition: string
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          rarity: string
          slug: string
          target_scope: string
          uses_per_card: number
        }
        Insert: {
          category: string
          counts_toward_normal_limit?: boolean
          created_at?: string
          description?: string
          disposition?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          rarity: string
          slug: string
          target_scope?: string
          uses_per_card?: number
        }
        Update: {
          category?: string
          counts_toward_normal_limit?: boolean
          created_at?: string
          description?: string
          disposition?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          rarity?: string
          slug?: string
          target_scope?: string
          uses_per_card?: number
        }
        Relationships: []
      }
      card_effects: {
        Row: {
          card_id: string
          created_at: string
          duration_type: string
          duration_unit: string
          duration_value: number | null
          effect_key: string
          effect_value: number | null
          id: string
          is_active: boolean
          operation: string
          parameters: Json
          sort_order: number
        }
        Insert: {
          card_id: string
          created_at?: string
          duration_type?: string
          duration_unit?: string
          duration_value?: number | null
          effect_key: string
          effect_value?: number | null
          id?: string
          is_active?: boolean
          operation?: string
          parameters?: Json
          sort_order?: number
        }
        Update: {
          card_id?: string
          created_at?: string
          duration_type?: string
          duration_unit?: string
          duration_value?: number | null
          effect_key?: string
          effect_value?: number | null
          id?: string
          is_active?: boolean
          operation?: string
          parameters?: Json
          sort_order?: number
        }
        Relationships: [{
          foreignKeyName: "card_effects_card_id_fkey"
          columns: ["card_id"]
          isOneToOne: false
          referencedRelation: "card_catalog"
          referencedColumns: ["id"]
        }]
      }
      card_activity: {
        Row: {
          activity_type: string
          actor_id: string | null
          card_instance_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          card_instance_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          card_instance_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_activity_card_instance_id_fkey"
            columns: ["card_instance_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      card_evolution_ingredients: {
        Row: {
          card_id: string
          quantity: number
          rule_id: string
        }
        Insert: {
          card_id: string
          quantity?: number
          rule_id: string
        }
        Update: {
          card_id?: string
          quantity?: number
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_evolution_ingredients_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "card_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_evolution_ingredients_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "card_evolution_rules"
            referencedColumns: ["id"]
          }
        ]
      }
      card_evolution_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          result_card_id: string
          same_tramo_only: boolean
          slug: string
          source_card_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          result_card_id: string
          same_tramo_only?: boolean
          slug: string
          source_card_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          result_card_id?: string
          same_tramo_only?: boolean
          slug?: string
          source_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_evolution_rules_source_card_id_fkey"
            columns: ["source_card_id"]
            isOneToOne: true
            referencedRelation: "card_catalog"
            referencedColumns: ["id"]
          }, {
          foreignKeyName: "card_evolution_rules_result_card_id_fkey"
          columns: ["result_card_id"]
          isOneToOne: false
          referencedRelation: "card_catalog"
          referencedColumns: ["id"]
        }]
      }
      player_effects: {
        Row: {
          applied_by: string | null
          created_at: string
          duration_type: string
          duration_unit: string
          duration_value: number | null
          effect_key: string
          effect_value: number | null
          expires_after_tramo: number | null
          expires_at: string | null
          id: string
          operation: string
          owner_id: string
          parameters: Json
          remaining_uses: number | null
          source_card_instance_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          duration_type: string
          duration_unit?: string
          duration_value?: number | null
          effect_key: string
          effect_value?: number | null
          expires_after_tramo?: number | null
          expires_at?: string | null
          id?: string
          operation: string
          owner_id: string
          parameters?: Json
          remaining_uses?: number | null
          source_card_instance_id?: string | null
          starts_at?: string
          status?: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          duration_type?: string
          duration_unit?: string
          duration_value?: number | null
          effect_key?: string
          effect_value?: number | null
          expires_after_tramo?: number | null
          expires_at?: string | null
          id?: string
          operation?: string
          owner_id?: string
          parameters?: Json
          remaining_uses?: number | null
          source_card_instance_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_effects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_effects_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_effects_source_card_instance_id_fkey"
            columns: ["source_card_instance_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      player_roulette_unlocks: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          owner_id: string
          pool_id: string
          source_card_instance_id: string | null
          spins_granted: number
          spins_used: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          pool_id: string
          source_card_instance_id?: string | null
          spins_granted?: number
          spins_used?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          pool_id?: string
          source_card_instance_id?: string | null
          spins_granted?: number
          spins_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_roulette_unlocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_roulette_unlocks_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "roulette_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_roulette_unlocks_source_card_instance_id_fkey"
            columns: ["source_card_instance_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      roulette_pool_cards: {
        Row: {
          card_id: string
          created_at: string
          is_active: boolean
          pool_id: string
          weight: number
        }
        Insert: {
          card_id: string
          created_at?: string
          is_active?: boolean
          pool_id: string
          weight?: number
        }
        Update: {
          card_id?: string
          created_at?: string
          is_active?: boolean
          pool_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "roulette_pool_cards_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "roulette_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_pool_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "card_catalog"
            referencedColumns: ["id"]
          }
        ]
      }
      roulette_pools: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          pool_type: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          pool_type: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          pool_type?: string
          slug?: string
        }
        Relationships: []
      }
      event_effects: {
        Row: {
          applied_by: string | null
          created_at: string
          duration_type: string
          duration_unit: string
          duration_value: number | null
          effect_key: string
          effect_value: number | null
          expires_after_tramo: number | null
          expires_at: string | null
          id: string
          operation: string
          parameters: Json
          remaining_uses: number | null
          source_card_instance_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          duration_type: string
          duration_unit?: string
          duration_value?: number | null
          effect_key: string
          effect_value?: number | null
          expires_after_tramo?: number | null
          expires_at?: string | null
          id?: string
          operation: string
          parameters?: Json
          remaining_uses?: number | null
          source_card_instance_id?: string | null
          starts_at?: string
          status?: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          duration_type?: string
          duration_unit?: string
          duration_value?: number | null
          effect_key?: string
          effect_value?: number | null
          expires_after_tramo?: number | null
          expires_at?: string | null
          id?: string
          operation?: string
          parameters?: Json
          remaining_uses?: number | null
          source_card_instance_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_effects_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_effects_source_card_instance_id_fkey"
            columns: ["source_card_instance_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      event_settings: {
        Row: {
          cards_per_tramo: number
          current_tramo: number
          normal_card_limit: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          cards_per_tramo?: number
          current_tramo?: number
          normal_card_limit?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          cards_per_tramo?: number
          current_tramo?: number
          normal_card_limit?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          notification_type: string
          payload: Json
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          notification_type: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          notification_type?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cards: {
        Row: {
          card_id: string
          id: string
          obtained_at: string
          owner_id: string
          remaining_uses: number
          source: string
          status: string
          tramo_number: number | null
        }
        Insert: {
          card_id: string
          id?: string
          obtained_at?: string
          owner_id: string
          remaining_uses?: number
          source: string
          status?: string
          tramo_number?: number | null
        }
        Update: {
          card_id?: string
          id?: string
          obtained_at?: string
          owner_id?: string
          remaining_uses?: number
          source?: string
          status?: string
          tramo_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "card_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_type_status: {
        Row: {
          is_enabled: boolean
          owner_id: string
          type_slug: string
          updated_at: string
        }
        Insert: {
          is_enabled?: boolean
          owner_id: string
          type_slug: string
          updated_at?: string
        }
        Update: {
          is_enabled?: boolean
          owner_id?: string
          type_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_type_status_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tramo_progress: {
        Row: {
          bonus_spins_remaining: number
          current_tramo: number
          owner_id: string
          spins_remaining: number
          updated_at: string
        }
        Insert: {
          bonus_spins_remaining?: number
          current_tramo?: number
          owner_id: string
          spins_remaining?: number
          updated_at?: string
        }
        Update: {
          bonus_spins_remaining?: number
          current_tramo?: number
          owner_id?: string
          spins_remaining?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_tramo_progress_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_save_snapshots: {
        Row: {
          bag: Json
          boxes: Json
          game_title: string
          parser_version: string | null
          party: Json
          player_id: string
          save_checksum: string | null
          save_format: string
          synced_at: string | null
          trainer_data: Json
          updated_at: string
        }
        Insert: {
          bag?: Json
          boxes?: Json
          game_title?: string
          parser_version?: string | null
          party?: Json
          player_id: string
          save_checksum?: string | null
          save_format?: string
          synced_at?: string | null
          trainer_data?: Json
          updated_at?: string
        }
        Update: {
          bag?: Json
          boxes?: Json
          game_title?: string
          parser_version?: string | null
          party?: Json
          player_id?: string
          save_checksum?: string | null
          save_format?: string
          synced_at?: string | null
          trainer_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_save_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_current_user_admin: { Args: never; Returns: boolean }
      draw_random_card: { Args: never; Returns: Json }
      issue_tramo_cards: { Args: never; Returns: Json }
      start_new_tramo: { Args: never; Returns: Json }
      play_card: {
        Args: { p_card_instance_id: string; p_target_id?: string | null }
        Returns: Json
      }
      evolve_card: {
        Args: { p_card_instance_id: string }
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

