export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      execution_history: {
        Row: {
          created_at: string;
          execution_time: number;
          id: string;
          output: string | null;
          runtime_status: Database["public"]["Enums"]["execution_status"];
          snippet_code: string;
          snippet_id: string | null;
          snippet_language: Database["public"]["Enums"]["code_language"];
          snippet_title: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          execution_time?: number;
          id?: string;
          output?: string | null;
          runtime_status?: Database["public"]["Enums"]["execution_status"];
          snippet_code?: string;
          snippet_id?: string | null;
          snippet_language?: Database["public"]["Enums"]["code_language"];
          snippet_title?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          execution_time?: number;
          id?: string;
          output?: string | null;
          runtime_status?: Database["public"]["Enums"]["execution_status"];
          snippet_code?: string;
          snippet_id?: string | null;
          snippet_language?: Database["public"]["Enums"]["code_language"];
          snippet_title?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "execution_history_snippet_id_fkey";
            columns: ["snippet_id"];
            isOneToOne: false;
            referencedRelation: "snippets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "execution_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "execution_history_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          last_seen_at: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      snippets: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          language: Database["public"]["Enums"]["code_language"];
          last_opened_at: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          language: Database["public"]["Enums"]["code_language"];
          last_opened_at?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["code_language"];
          last_opened_at?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snippets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "snippets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          auto_save: boolean;
          created_at: string;
          editor_font_size: number;
          telemetry_enabled: boolean;
          theme: "system" | "light" | "dark";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_save?: boolean;
          created_at?: string;
          editor_font_size?: number;
          telemetry_enabled?: boolean;
          theme?: "system" | "light" | "dark";
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          auto_save?: boolean;
          created_at?: string;
          editor_font_size?: number;
          telemetry_enabled?: boolean;
          theme?: "system" | "light" | "dark";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_owns_snippet: {
        Args: {
          target_snippet_id: string;
          target_user_id: string;
        };
        Returns: boolean;
      };
      user_owns_workspace: {
        Args: {
          target_user_id: string;
          target_workspace_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      code_language: "javascript" | "python" | "c" | "cpp" | "java";
      execution_status: "completed" | "error" | "timeout";
    };
    CompositeTypes: Record<string, never>;
  };
}
