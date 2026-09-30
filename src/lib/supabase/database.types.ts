export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      business_settings: {
        Row: {
          address: string | null;
          currency: string;
          email: string | null;
          id: number;
          legal_name: string | null;
          logo_url: string | null;
          name: string;
          phone: string | null;
          receipt_footer: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          currency?: string;
          email?: string | null;
          id?: number;
          legal_name?: string | null;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          receipt_footer?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          currency?: string;
          email?: string | null;
          id?: number;
          legal_name?: string | null;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          receipt_footer?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          address: string | null;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["location_kind"];
          name: string;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["location_kind"];
          name: string;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["location_kind"];
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          sort_order: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          sort_order?: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          sort_order?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          search_text: string;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          search_text?: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          search_text?: string;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          location_id: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["staff_role"];
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          location_id?: string | null;
          phone?: string | null;
          role: Database["public"]["Enums"]["staff_role"];
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          location_id?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["staff_role"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      sku_costs: {
        Row: {
          cost_kobo: number;
          sku_id: string;
          updated_at: string;
        };
        Insert: {
          cost_kobo: number;
          sku_id: string;
          updated_at?: string;
        };
        Update: {
          cost_kobo?: number;
          sku_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sku_costs_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: true;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
        ];
      };
      skus: {
        Row: {
          barcode: string | null;
          code: string;
          coverage_m2: number | null;
          created_at: string;
          id: string;
          is_active: boolean;
          price_kobo: number;
          product_id: string;
          promo_price_kobo: number | null;
          roll_length_cm: number | null;
          roll_width_cm: number | null;
          sort_order: number;
          updated_at: string;
          variant_label: string | null;
        };
        Insert: {
          barcode?: string | null;
          code: string;
          coverage_m2?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          price_kobo: number;
          product_id: string;
          promo_price_kobo?: number | null;
          roll_length_cm?: number | null;
          roll_width_cm?: number | null;
          sort_order?: number;
          updated_at?: string;
          variant_label?: string | null;
        };
        Update: {
          barcode?: string | null;
          code?: string;
          coverage_m2?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          price_kobo?: number;
          product_id?: string;
          promo_price_kobo?: number | null;
          roll_length_cm?: number | null;
          roll_width_cm?: number | null;
          sort_order?: number;
          updated_at?: string;
          variant_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "skus_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          abbreviation: string;
          allows_decimal: boolean;
          coverage: Database["public"]["Enums"]["unit_coverage"];
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          abbreviation: string;
          allows_decimal?: boolean;
          coverage?: Database["public"]["Enums"]["unit_coverage"];
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          abbreviation?: string;
          allows_decimal?: boolean;
          coverage?: Database["public"]["Enums"]["unit_coverage"];
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_staff_location: { Args: Record<PropertyKey, never>; Returns: string };
      current_staff_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["staff_role"] };
      import_products: { Args: { products: Json }; Returns: number };
      is_manager_or_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      refresh_product_search_text: { Args: { p_product_id: string }; Returns: undefined };
      save_product: { Args: { payload: Json }; Returns: string };
    };
    Enums: {
      location_kind: "shop" | "warehouse";
      staff_role: "owner" | "manager" | "cashier" | "warehouse";
      unit_coverage: "none" | "roll" | "area";
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
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      location_kind: ["shop", "warehouse"],
      staff_role: ["owner", "manager", "cashier", "warehouse"],
      unit_coverage: ["none", "roll", "area"],
    },
  },
} as const;
