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
      admin_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          permission: string
          role: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          permission: string
          role: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          permission?: string
          role?: string
        }
        Relationships: []
      }
      crash_reports: {
        Row: {
          created_at: string
          error_message: string
          id: string
          language: Database["public"]["Enums"]["code_language"] | null
          metadata: Json
          severity: string
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"] | null
          metadata?: Json
          severity?: string
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"] | null
          metadata?: Json
          severity?: string
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      execution_history: {
        Row: {
          created_at: string
          execution_time: number
          id: string
          output: string | null
          runtime_status: Database["public"]["Enums"]["execution_status"]
          snippet_code: string
          snippet_id: string | null
          snippet_language: Database["public"]["Enums"]["code_language"]
          snippet_title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          execution_time?: number
          id?: string
          output?: string | null
          runtime_status?: Database["public"]["Enums"]["execution_status"]
          snippet_code: string
          snippet_id?: string | null
          snippet_language: Database["public"]["Enums"]["code_language"]
          snippet_title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          execution_time?: number
          id?: string
          output?: string | null
          runtime_status?: Database["public"]["Enums"]["execution_status"]
          snippet_code?: string
          snippet_id?: string | null
          snippet_language?: Database["public"]["Enums"]["code_language"]
          snippet_title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_history_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "snippets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_logs: {
        Row: {
          code_length: number
          code_preview: string | null
          compile_time: number
          created_at: string
          error_message: string | null
          error_type: string | null
          execution_time: number
          id: string
          language: Database["public"]["Enums"]["code_language"]
          metadata: Json
          runtime_status: string
          success: boolean
          trace_time: number
          user_id: string | null
        }
        Insert: {
          code_length?: number
          code_preview?: string | null
          compile_time?: number
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          execution_time?: number
          id?: string
          language: Database["public"]["Enums"]["code_language"]
          metadata?: Json
          runtime_status?: string
          success?: boolean
          trace_time?: number
          user_id?: string | null
        }
        Update: {
          code_length?: number
          code_preview?: string | null
          compile_time?: number
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          execution_time?: number
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          metadata?: Json
          runtime_status?: string
          success?: boolean
          trace_time?: number
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          status?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lesson_bookmarks: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          last_position: number
          lesson_id: string
          progress_percentage: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          last_position?: number
          lesson_id: string
          progress_percentage?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          last_position?: number
          lesson_id?: string
          progress_percentage?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          category_id: string | null
          content: Json
          created_at: string
          description: string
          difficulty: string
          estimated_duration: number
          id: string
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: Json
          created_at?: string
          description: string
          difficulty?: string
          estimated_duration?: number
          id?: string
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: Json
          created_at?: string
          description?: string
          difficulty?: string
          estimated_duration?: number
          id?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lesson_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_admin: boolean
          last_seen_at: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_admin?: boolean
          last_seen_at?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_admin?: boolean
          last_seen_at?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          lesson_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          id?: string
          lesson_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          lesson_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      snippets: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          language: Database["public"]["Enums"]["code_language"]
          last_opened_at: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          language: Database["public"]["Enums"]["code_language"]
          last_opened_at?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          last_opened_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          action: string
          created_at: string
          id: string
          language: Database["public"]["Enums"]["code_language"] | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"] | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"] | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_save: boolean
          created_at: string
          editor_font_size: number
          telemetry_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_save?: boolean
          created_at?: string
          editor_font_size?: number
          telemetry_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_save?: boolean
          created_at?: string
          editor_font_size?: number
          telemetry_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visualization_sessions: {
        Row: {
          created_at: string
          id: string
          language: Database["public"]["Enums"]["code_language"]
          metadata: Json
          playback_duration: number
          total_steps: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          language: Database["public"]["Enums"]["code_language"]
          metadata?: Json
          playback_duration?: number
          total_steps?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["code_language"]
          metadata?: Json
          playback_duration?: number
          total_steps?: number
          user_id?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: { Args: { target_user_id?: string }; Returns: boolean }
      user_owns_snippet: {
        Args: { target_snippet_id: string; target_user_id: string }
        Returns: boolean
      }
      user_owns_workspace: {
        Args: { target_user_id: string; target_workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      code_language: "javascript" | "python" | "c" | "cpp" | "java"
      execution_status: "completed" | "error" | "timeout"
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
    Enums: {
      code_language: ["javascript", "python", "c", "cpp", "java"],
      execution_status: ["completed", "error", "timeout"],
    },
  },
} as const
