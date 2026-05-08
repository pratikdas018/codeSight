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
          snippet_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          execution_time: number;
          id?: string;
          output?: string | null;
          snippet_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          execution_time?: number;
          id?: string;
          output?: string | null;
          snippet_id?: string;
          user_id?: string;
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
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      snippets: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          language: "javascript" | "python" | "c" | "cpp" | "java";
          title: string;
          user_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          language: "javascript" | "python" | "c" | "cpp" | "java";
          title: string;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          language?: "javascript" | "python" | "c" | "cpp" | "java";
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snippets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
