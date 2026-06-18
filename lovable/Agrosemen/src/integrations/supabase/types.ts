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
      bulls: {
        Row: {
          botijao_convencional: string
          botijao_sexado_femea: string
          botijao_sexado_macho: string
          breed: string
          canister_convencional: string
          canister_sexado_femea: string
          canister_sexado_macho: string
          code: string
          code_convencional: string
          code_sexado_femea: string
          code_sexado_macho: string
          created_at: string
          id: string
          location: string
          name: string
          photo: string | null
          price_convencional: number
          price_sexado: number
          price_sexado_femea: number
          price_sexado_macho: number
          quantity: number
          quantity_sexado: number
          quantity_sexado_femea: number
          quantity_sexado_macho: number
          supplier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          botijao_convencional?: string
          botijao_sexado_femea?: string
          botijao_sexado_macho?: string
          breed?: string
          canister_convencional?: string
          canister_sexado_femea?: string
          canister_sexado_macho?: string
          code?: string
          code_convencional?: string
          code_sexado_femea?: string
          code_sexado_macho?: string
          created_at?: string
          id?: string
          location?: string
          name: string
          photo?: string | null
          price_convencional?: number
          price_sexado?: number
          price_sexado_femea?: number
          price_sexado_macho?: number
          quantity?: number
          quantity_sexado?: number
          quantity_sexado_femea?: number
          quantity_sexado_macho?: number
          supplier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          botijao_convencional?: string
          botijao_sexado_femea?: string
          botijao_sexado_macho?: string
          breed?: string
          canister_convencional?: string
          canister_sexado_femea?: string
          canister_sexado_macho?: string
          code?: string
          code_convencional?: string
          code_sexado_femea?: string
          code_sexado_macho?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          photo?: string | null
          price_convencional?: number
          price_sexado?: number
          price_sexado_femea?: number
          price_sexado_macho?: number
          quantity?: number
          quantity_sexado?: number
          quantity_sexado_femea?: number
          quantity_sexado_macho?: number
          supplier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          location: string
          name: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string
          name: string
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inseminations: {
        Row: {
          bull_id: string | null
          bull_name: string
          client: string
          client_id: string | null
          cow_id: string
          created_at: string
          date: string
          id: string
          price: number
          semen_type: string
          user_id: string
          user_name: string
        }
        Insert: {
          bull_id?: string | null
          bull_name: string
          client: string
          client_id?: string | null
          cow_id: string
          created_at?: string
          date?: string
          id?: string
          price?: number
          semen_type?: string
          user_id: string
          user_name?: string
        }
        Update: {
          bull_id?: string | null
          bull_name?: string
          client?: string
          client_id?: string | null
          cow_id?: string
          created_at?: string
          date?: string
          id?: string
          price?: number
          semen_type?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inseminations_bull_id_fkey"
            columns: ["bull_id"]
            isOneToOne: false
            referencedRelation: "bulls"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          bull_id: string | null
          bull_name: string
          date: string
          id: string
          quantity: number
          semen_type: string
          type: string
          user_id: string
          user_name: string
        }
        Insert: {
          bull_id?: string | null
          bull_name: string
          date?: string
          id?: string
          quantity: number
          semen_type?: string
          type: string
          user_id: string
          user_name?: string
        }
        Update: {
          bull_id?: string | null
          bull_name?: string
          date?: string
          id?: string
          quantity?: number
          semen_type?: string
          type?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_bull_id_fkey"
            columns: ["bull_id"]
            isOneToOne: false
            referencedRelation: "bulls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          default_price: number
          default_price_convencional: number
          default_price_sexado: number
          display_name: string
          min_stock: number
          profile: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string
        }
        Insert: {
          default_price?: number
          default_price_convencional?: number
          default_price_sexado?: number
          display_name?: string
          min_stock?: number
          profile?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string
        }
        Update: {
          default_price?: number
          default_price_convencional?: number
          default_price_sexado?: number
          display_name?: string
          min_stock?: number
          profile?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_catalog: {
        Args: { _user_id: string }
        Returns: {
          bull_breed: string
          bull_code: string
          bull_id: string
          bull_name: string
          bull_photo: string
          bull_quantity: number
          bull_quantity_sexado: number
          farm_name: string
          whatsapp_number: string
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
