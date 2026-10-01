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
      adjustment_lines: {
        Row: {
          adjustment_id: string;
          batch: string;
          id: string;
          quantity: number;
          reason: string | null;
          sku_id: string;
          sort_order: number;
          system_quantity: number;
        };
        Insert: {
          adjustment_id: string;
          batch?: string;
          id?: string;
          quantity: number;
          reason?: string | null;
          sku_id: string;
          sort_order?: number;
          system_quantity?: number;
        };
        Update: {
          adjustment_id?: string;
          batch?: string;
          id?: string;
          quantity?: number;
          reason?: string | null;
          sku_id?: string;
          sort_order?: number;
          system_quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "adjustment_lines_adjustment_id_fkey";
            columns: ["adjustment_id"];
            isOneToOne: false;
            referencedRelation: "adjustments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustment_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustment_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      adjustments: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["adjustment_kind"];
          location_id: string;
          note: string | null;
          number: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["adjustment_status"];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["adjustment_kind"];
          location_id: string;
          note?: string | null;
          number?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["adjustment_status"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["adjustment_kind"];
          location_id?: string;
          note?: string | null;
          number?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["adjustment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "adjustments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustments_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustments_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjustments_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
        ];
      };
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
          vat_enabled: boolean;
          vat_number: string | null;
          vat_rate: number;
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
          vat_enabled?: boolean;
          vat_number?: string | null;
          vat_rate?: number;
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
          vat_enabled?: boolean;
          vat_number?: string | null;
          vat_rate?: number;
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
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      drawer_openings: {
        Row: {
          created_at: string;
          id: string;
          location_id: string;
          opened_by: string | null;
          reason: string;
          shift_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          location_id: string;
          opened_by?: string | null;
          reason: string;
          shift_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          location_id?: string;
          opened_by?: string | null;
          reason?: string;
          shift_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drawer_openings_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drawer_openings_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drawer_openings_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drawer_openings_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
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
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["product_id"];
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
          track_batches: boolean;
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
          track_batches?: boolean;
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
          track_batches?: boolean;
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
      receipt_costs: {
        Row: {
          receipt_id: string;
          sku_id: string;
          unit_cost_kobo: number;
        };
        Insert: {
          receipt_id: string;
          sku_id: string;
          unit_cost_kobo: number;
        };
        Update: {
          receipt_id?: string;
          sku_id?: string;
          unit_cost_kobo?: number;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_costs_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_costs_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_costs_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      receipt_lines: {
        Row: {
          batch: string;
          id: string;
          quantity: number;
          receipt_id: string;
          sku_id: string;
          sort_order: number;
        };
        Insert: {
          batch?: string;
          id?: string;
          quantity: number;
          receipt_id: string;
          sku_id: string;
          sort_order?: number;
        };
        Update: {
          batch?: string;
          id?: string;
          quantity?: number;
          receipt_id?: string;
          sku_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_lines_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      receipts: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          location_id: string;
          note: string | null;
          number: string;
          posted_at: string | null;
          posted_by: string | null;
          received_on: string;
          status: Database["public"]["Enums"]["receipt_status"];
          supplier_name: string | null;
          supplier_reference: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id: string;
          note?: string | null;
          number?: string;
          posted_at?: string | null;
          posted_by?: string | null;
          received_on?: string;
          status?: Database["public"]["Enums"]["receipt_status"];
          supplier_name?: string | null;
          supplier_reference?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string;
          note?: string | null;
          number?: string;
          posted_at?: string | null;
          posted_by?: string | null;
          received_on?: string;
          status?: Database["public"]["Enums"]["receipt_status"];
          supplier_name?: string | null;
          supplier_reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_posted_by_fkey";
            columns: ["posted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_posted_by_fkey";
            columns: ["posted_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
        ];
      };
      reorder_levels: {
        Row: {
          location_id: string;
          reorder_level: number;
          sku_id: string;
        };
        Insert: {
          location_id: string;
          reorder_level: number;
          sku_id: string;
        };
        Update: {
          location_id?: string;
          reorder_level?: number;
          sku_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reorder_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reorder_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reorder_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      return_lines: {
        Row: {
          condition: Database["public"]["Enums"]["return_condition"];
          id: string;
          quantity: number;
          refund_kobo: number;
          return_id: string;
          sale_line_id: string;
        };
        Insert: {
          condition: Database["public"]["Enums"]["return_condition"];
          id?: string;
          quantity: number;
          refund_kobo: number;
          return_id: string;
          sale_line_id: string;
        };
        Update: {
          condition?: Database["public"]["Enums"]["return_condition"];
          id?: string;
          quantity?: number;
          refund_kobo?: number;
          return_id?: string;
          sale_line_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "return_lines_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "sale_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      returns: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          location_id: string;
          number: string;
          reason: string;
          refund_kobo: number;
          refund_method: Database["public"]["Enums"]["payment_method"];
          sale_id: string;
          shift_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id: string;
          number?: string;
          reason: string;
          refund_kobo: number;
          refund_method: Database["public"]["Enums"]["payment_method"];
          sale_id: string;
          shift_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string;
          number?: string;
          reason?: string;
          refund_kobo?: number;
          refund_method?: Database["public"]["Enums"]["payment_method"];
          sale_id?: string;
          shift_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "returns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_line_costs: {
        Row: {
          cost_kobo: number;
          sale_line_id: string;
        };
        Insert: {
          cost_kobo: number;
          sale_line_id: string;
        };
        Update: {
          cost_kobo?: number;
          sale_line_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_line_costs_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: true;
            referencedRelation: "sale_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_lines: {
        Row: {
          batch: string;
          id: string;
          line_total_kobo: number;
          list_price_kobo: number;
          quantity: number;
          returned_quantity: number;
          sale_id: string;
          sku_id: string;
          sort_order: number;
          unit_price_kobo: number;
        };
        Insert: {
          batch?: string;
          id?: string;
          line_total_kobo: number;
          list_price_kobo: number;
          quantity: number;
          returned_quantity?: number;
          sale_id: string;
          sku_id: string;
          sort_order?: number;
          unit_price_kobo: number;
        };
        Update: {
          batch?: string;
          id?: string;
          line_total_kobo?: number;
          list_price_kobo?: number;
          quantity?: number;
          returned_quantity?: number;
          sale_id?: string;
          sku_id?: string;
          sort_order?: number;
          unit_price_kobo?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_lines_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      sale_payments: {
        Row: {
          amount_kobo: number;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          reference: string | null;
          sale_id: string;
          tendered_kobo: number | null;
        };
        Insert: {
          amount_kobo: number;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          sale_id: string;
          tendered_kobo?: number | null;
        };
        Update: {
          amount_kobo?: number;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          sale_id?: string;
          tendered_kobo?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          cashier_id: string | null;
          created_at: string;
          customer_id: string | null;
          delivery_address: string | null;
          delivery_area: string | null;
          delivery_date: string | null;
          delivery_fee_kobo: number;
          fulfilment: Database["public"]["Enums"]["fulfilment"];
          fulfilment_status: Database["public"]["Enums"]["fulfilment_status"];
          fulfilment_updated_at: string | null;
          fulfilment_updated_by: string | null;
          id: string;
          location_id: string;
          note: string | null;
          number: string;
          receipt_token: string;
          shift_id: string;
          subtotal_kobo: number;
          total_kobo: number;
          vat_kobo: number;
          vat_rate: number | null;
        };
        Insert: {
          cashier_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          delivery_address?: string | null;
          delivery_area?: string | null;
          delivery_date?: string | null;
          delivery_fee_kobo?: number;
          fulfilment?: Database["public"]["Enums"]["fulfilment"];
          fulfilment_status?: Database["public"]["Enums"]["fulfilment_status"];
          fulfilment_updated_at?: string | null;
          fulfilment_updated_by?: string | null;
          id?: string;
          location_id: string;
          note?: string | null;
          number?: string;
          receipt_token?: string;
          shift_id: string;
          subtotal_kobo: number;
          total_kobo: number;
          vat_kobo?: number;
          vat_rate?: number | null;
        };
        Update: {
          cashier_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          delivery_address?: string | null;
          delivery_area?: string | null;
          delivery_date?: string | null;
          delivery_fee_kobo?: number;
          fulfilment?: Database["public"]["Enums"]["fulfilment"];
          fulfilment_status?: Database["public"]["Enums"]["fulfilment_status"];
          fulfilment_updated_at?: string | null;
          fulfilment_updated_by?: string | null;
          id?: string;
          location_id?: string;
          note?: string | null;
          number?: string;
          receipt_token?: string;
          shift_id?: string;
          subtotal_kobo?: number;
          total_kobo?: number;
          vat_kobo?: number;
          vat_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_fulfilment_updated_by_fkey";
            columns: ["fulfilment_updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_fulfilment_updated_by_fkey";
            columns: ["fulfilment_updated_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          close_note: string | null;
          closed_at: string | null;
          closed_by: string | null;
          counted_card_kobo: number | null;
          counted_cash_kobo: number | null;
          counted_transfer_kobo: number | null;
          expected_card_kobo: number | null;
          expected_cash_kobo: number | null;
          expected_transfer_kobo: number | null;
          id: string;
          location_id: string;
          opened_at: string;
          opened_by: string | null;
          opening_float_kobo: number;
          status: Database["public"]["Enums"]["shift_status"];
        };
        Insert: {
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          counted_card_kobo?: number | null;
          counted_cash_kobo?: number | null;
          counted_transfer_kobo?: number | null;
          expected_card_kobo?: number | null;
          expected_cash_kobo?: number | null;
          expected_transfer_kobo?: number | null;
          id?: string;
          location_id: string;
          opened_at?: string;
          opened_by?: string | null;
          opening_float_kobo: number;
          status?: Database["public"]["Enums"]["shift_status"];
        };
        Update: {
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          counted_card_kobo?: number | null;
          counted_cash_kobo?: number | null;
          counted_transfer_kobo?: number | null;
          expected_card_kobo?: number | null;
          expected_cash_kobo?: number | null;
          expected_transfer_kobo?: number | null;
          id?: string;
          location_id?: string;
          opened_at?: string;
          opened_by?: string | null;
          opening_float_kobo?: number;
          status?: Database["public"]["Enums"]["shift_status"];
        };
        Relationships: [
          {
            foreignKeyName: "shifts_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
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
          {
            foreignKeyName: "sku_costs_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: true;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
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
          {
            foreignKeyName: "skus_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["product_id"];
          },
        ];
      };
      stock_levels: {
        Row: {
          batch: string;
          location_id: string;
          quantity: number;
          sku_id: string;
          updated_at: string;
        };
        Insert: {
          batch?: string;
          location_id: string;
          quantity?: number;
          sku_id: string;
          updated_at?: string;
        };
        Update: {
          batch?: string;
          location_id?: string;
          quantity?: number;
          sku_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          batch: string;
          created_at: string;
          created_by: string | null;
          id: number;
          location_id: string;
          note: string | null;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          sku_id: string;
          type: Database["public"]["Enums"]["movement_type"];
        };
        Insert: {
          batch?: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          location_id: string;
          note?: string | null;
          quantity: number;
          reference_id?: string | null;
          reference_type?: string | null;
          sku_id: string;
          type: Database["public"]["Enums"]["movement_type"];
        };
        Update: {
          batch?: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          location_id?: string;
          note?: string | null;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          sku_id?: string;
          type?: Database["public"]["Enums"]["movement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      transfer_items: {
        Row: {
          batch: string;
          dispatched_quantity: number;
          id: string;
          received_quantity: number | null;
          shortage_reason: string | null;
          sku_id: string;
          sort_order: number;
          transfer_id: string;
        };
        Insert: {
          batch?: string;
          dispatched_quantity: number;
          id?: string;
          received_quantity?: number | null;
          shortage_reason?: string | null;
          sku_id: string;
          sort_order?: number;
          transfer_id: string;
        };
        Update: {
          batch?: string;
          dispatched_quantity?: number;
          id?: string;
          received_quantity?: number | null;
          shortage_reason?: string | null;
          sku_id?: string;
          sort_order?: number;
          transfer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_items_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_items_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "transfers";
            referencedColumns: ["id"];
          },
        ];
      };
      transfer_lines: {
        Row: {
          id: string;
          requested_quantity: number;
          sku_id: string;
          sort_order: number;
          transfer_id: string;
        };
        Insert: {
          id?: string;
          requested_quantity: number;
          sku_id: string;
          sort_order?: number;
          transfer_id: string;
        };
        Update: {
          id?: string;
          requested_quantity?: number;
          sku_id?: string;
          sort_order?: number;
          transfer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_lines_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
          {
            foreignKeyName: "transfer_lines_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "transfers";
            referencedColumns: ["id"];
          },
        ];
      };
      transfers: {
        Row: {
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          dispatch_note: string | null;
          dispatched_at: string | null;
          dispatched_by: string | null;
          from_location_id: string;
          has_shortage: boolean;
          id: string;
          note: string | null;
          number: string;
          received_at: string | null;
          received_by: string | null;
          requested_at: string;
          requested_by: string | null;
          shortage_resolution: string | null;
          shortage_resolved_at: string | null;
          shortage_resolved_by: string | null;
          status: Database["public"]["Enums"]["transfer_status"];
          to_location_id: string;
        };
        Insert: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          dispatch_note?: string | null;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          from_location_id: string;
          has_shortage?: boolean;
          id?: string;
          note?: string | null;
          number?: string;
          received_at?: string | null;
          received_by?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          shortage_resolution?: string | null;
          shortage_resolved_at?: string | null;
          shortage_resolved_by?: string | null;
          status?: Database["public"]["Enums"]["transfer_status"];
          to_location_id: string;
        };
        Update: {
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          dispatch_note?: string | null;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          from_location_id?: string;
          has_shortage?: boolean;
          id?: string;
          note?: string | null;
          number?: string;
          received_at?: string | null;
          received_by?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          shortage_resolution?: string | null;
          shortage_resolved_at?: string | null;
          shortage_resolved_by?: string | null;
          status?: Database["public"]["Enums"]["transfer_status"];
          to_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfers_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_dispatched_by_fkey";
            columns: ["dispatched_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_dispatched_by_fkey";
            columns: ["dispatched_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_from_location_id_fkey";
            columns: ["from_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_shortage_resolved_by_fkey";
            columns: ["shortage_resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_shortage_resolved_by_fkey";
            columns: ["shortage_resolved_by"];
            isOneToOne: false;
            referencedRelation: "staff_directory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_to_location_id_fkey";
            columns: ["to_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
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
      sku_location_stock: {
        Row: {
          location_id: string | null;
          quantity: number | null;
          sku_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
        ];
      };
      staff_directory: {
        Row: {
          full_name: string | null;
          id: string | null;
          role: Database["public"]["Enums"]["staff_role"] | null;
        };
        Insert: {
          full_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["staff_role"] | null;
        };
        Update: {
          full_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["staff_role"] | null;
        };
        Relationships: [];
      };
      stock_in_transit: {
        Row: {
          location_id: string | null;
          quantity: number | null;
          sku_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_items_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "skus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_items_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["sku_id"];
          },
          {
            foreignKeyName: "transfers_to_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_overview: {
        Row: {
          category_id: string | null;
          code: string | null;
          is_low: boolean | null;
          product_id: string | null;
          product_name: string | null;
          search_text: string | null;
          sku_id: string | null;
          sort_order: number | null;
          total_quantity: number | null;
          track_batches: boolean | null;
          unit: string | null;
          variant_label: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      apply_stock_movement: {
        Args: {
          p_batch: string;
          p_location_id: string;
          p_note: string;
          p_quantity: number;
          p_reference_id: string;
          p_reference_type: string;
          p_sku_id: string;
          p_type: Database["public"]["Enums"]["movement_type"];
        };
        Returns: undefined;
      };
      approve_adjustment: { Args: { p_adjustment_id: string; p_review_note?: string }; Returns: undefined };
      assert_at_either_end: { Args: { p_from: string; p_to: string }; Returns: undefined };
      assert_can_act_at: { Args: { p_location_id: string }; Returns: undefined };
      assert_can_sell_at: { Args: { p_location_id: string }; Returns: undefined };
      business_date: { Args: { p_at: string }; Returns: string };
      cancel_receipt: { Args: { p_receipt_id: string }; Returns: undefined };
      cancel_transfer: { Args: { p_reason: string; p_transfer_id: string }; Returns: undefined };
      close_shift: {
        Args: {
          p_counted_card: number;
          p_counted_cash: number;
          p_counted_transfer: number;
          p_note: string;
          p_shift_id: string;
        };
        Returns: undefined;
      };
      create_return: { Args: { payload: Json }; Returns: string };
      create_sale: { Args: { payload: Json }; Returns: string };
      create_transfer: { Args: { payload: Json }; Returns: string };
      current_staff_location: { Args: Record<PropertyKey, never>; Returns: string };
      current_staff_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["staff_role"] };
      dispatch_transfer: { Args: { p_items: Json; p_note?: string; p_transfer_id: string }; Returns: undefined };
      import_products: { Args: { products: Json }; Returns: number };
      is_manager_or_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      log_drawer_open: { Args: { p_location_id: string; p_reason: string }; Returns: undefined };
      normalize_phone: { Args: { p_phone: string }; Returns: string };
      open_shift: { Args: { p_float_kobo: number; p_location_id: string }; Returns: string };
      post_receipt: { Args: { p_receipt_id: string }; Returns: undefined };
      receive_transfer: { Args: { p_items: Json; p_transfer_id: string }; Returns: undefined };
      refresh_product_search_text: { Args: { p_product_id: string }; Returns: undefined };
      reject_adjustment: { Args: { p_adjustment_id: string; p_review_note: string }; Returns: undefined };
      report_losses: {
        Args: { p_from: string; p_location?: string; p_to: string };
        Returns: {
          code: string;
          happened_at: string;
          kind: string;
          location_id: string;
          product_name: string;
          quantity: number;
          reason: string;
          sku_id: string;
          value_kobo: number;
          variant_label: string;
        }[];
      };
      report_payments: {
        Args: { p_from: string; p_location?: string; p_to: string };
        Returns: {
          method: Database["public"]["Enums"]["payment_method"];
          received_kobo: number;
          refunded_kobo: number;
        }[];
      };
      report_products: {
        Args: { p_from: string; p_location?: string; p_to: string };
        Returns: {
          category_name: string;
          code: string;
          cost_kobo: number;
          costed_revenue_kobo: number;
          product_name: string;
          quantity: number;
          revenue_kobo: number;
          sku_id: string;
          unit: string;
          variant_label: string;
        }[];
      };
      report_sales_daily: {
        Args: { p_from: string; p_location?: string; p_to: string };
        Returns: {
          day: string;
          gross_kobo: number;
          items_sold: number;
          location_id: string;
          refunds_kobo: number;
          sales_count: number;
        }[];
      };
      report_slow_movers: {
        Args: { p_days: number; p_location?: string };
        Returns: {
          code: string;
          cost_kobo: number;
          last_sold_at: string;
          location_id: string;
          product_name: string;
          quantity: number;
          sku_id: string;
          variant_label: string;
        }[];
      };
      report_staff: {
        Args: { p_from: string; p_location?: string; p_to: string };
        Returns: {
          cash_difference_kobo: number;
          drawer_openings: number;
          returns_count: number;
          returns_kobo: number;
          sales_count: number;
          sales_kobo: number;
          sessions_closed: number;
          staff_id: string;
        }[];
      };
      resolve_transfer_shortage: { Args: { p_resolution: string; p_transfer_id: string }; Returns: undefined };
      save_product: { Args: { payload: Json }; Returns: string };
      save_receipt: { Args: { payload: Json }; Returns: string };
      set_reorder_level: { Args: { p_level: number; p_location_id: string; p_sku_id: string }; Returns: undefined };
      shift_expected: {
        Args: { p_shift_id: string };
        Returns: {
          expected_kobo: number;
          method: Database["public"]["Enums"]["payment_method"];
          refunds_kobo: number;
          sales_kobo: number;
        }[];
      };
      submit_adjustment: { Args: { payload: Json }; Returns: string };
      update_fulfilment: {
        Args: { p_sale_id: string; p_status: Database["public"]["Enums"]["fulfilment_status"] };
        Returns: undefined;
      };
    };
    Enums: {
      adjustment_kind: "opening" | "count" | "damage";
      adjustment_status: "pending" | "approved" | "rejected";
      fulfilment: "taken" | "collect_later" | "delivery";
      fulfilment_status: "pending" | "out_for_delivery" | "completed";
      location_kind: "shop" | "warehouse";
      movement_type:
        "opening" | "receipt" | "transfer_out" | "transfer_in" | "sale" | "return" | "damage" | "count_correction";
      payment_method: "cash" | "card" | "transfer";
      receipt_status: "draft" | "posted" | "cancelled";
      return_condition: "restock" | "damaged";
      shift_status: "open" | "closed";
      staff_role: "owner" | "manager" | "cashier" | "warehouse";
      transfer_status: "requested" | "dispatched" | "received" | "cancelled";
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
      adjustment_kind: ["opening", "count", "damage"],
      adjustment_status: ["pending", "approved", "rejected"],
      fulfilment: ["taken", "collect_later", "delivery"],
      fulfilment_status: ["pending", "out_for_delivery", "completed"],
      location_kind: ["shop", "warehouse"],
      movement_type: [
        "opening",
        "receipt",
        "transfer_out",
        "transfer_in",
        "sale",
        "return",
        "damage",
        "count_correction",
      ],
      payment_method: ["cash", "card", "transfer"],
      receipt_status: ["draft", "posted", "cancelled"],
      return_condition: ["restock", "damaged"],
      shift_status: ["open", "closed"],
      staff_role: ["owner", "manager", "cashier", "warehouse"],
      transfer_status: ["requested", "dispatched", "received", "cancelled"],
      unit_coverage: ["none", "roll", "area"],
    },
  },
} as const;
