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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_ip_allowlist: {
        Row: {
          cidr: string
          created_at: string
          created_by: number | null
          id: string
          label: string | null
        }
        Insert: {
          cidr: string
          created_at?: string
          created_by?: number | null
          id?: string
          label?: string | null
        }
        Update: {
          cidr?: string
          created_at?: string
          created_by?: number | null
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_ip_allowlist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_ip_allowlist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          admin_id: number | null
          content: string
          created_at: string | null
          id: number
          is_read: boolean
          title: string
          type: string
          user_id: number
        }
        Insert: {
          admin_id?: number | null
          content: string
          created_at?: string | null
          id?: number
          is_read?: boolean
          title: string
          type?: string
          user_id: number
        }
        Update: {
          admin_id?: number | null
          content?: string
          created_at?: string | null
          id?: number
          is_read?: boolean
          title?: string
          type?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tutor_messages: {
        Row: {
          content: string
          context_key: string
          created_at: string
          id: string
          role: string
          user_id: number
        }
        Insert: {
          content: string
          context_key: string
          created_at?: string
          id?: string
          role: string
          user_id: number
        }
        Update: {
          content?: string
          context_key?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_tutor_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tutor_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: number | null
          created_at: string
          details: Json | null
          id: number
          ip_address: string | null
          target_id: string | null
          target_type: string | null
          target_user_id: number | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: number | null
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: number | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: number | null
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string
          id: number
          is_active: boolean | null
          name: string
          points_reward: number | null
          requirement_type: string
          requirement_value: number
          unlocks_avatar_border: string | null
          unlocks_name_animation: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon: string
          id?: number
          is_active?: boolean | null
          name: string
          points_reward?: number | null
          requirement_type: string
          requirement_value: number
          unlocks_avatar_border?: string | null
          unlocks_name_animation?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string
          id?: number
          is_active?: boolean | null
          name?: string
          points_reward?: number | null
          requirement_type?: string
          requirement_value?: number
          unlocks_avatar_border?: string | null
          unlocks_name_animation?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          completed_at: string | null
          course_id: number | null
          created_at: string
          created_by: number
          created_by_role: string
          description: string | null
          end_date: string | null
          end_time: string | null
          event_type: string
          id: string
          owner_id: number
          reason: string | null
          source: string
          start_date: string
          start_time: string | null
          title: string
          updated_at: string
          visible_to_child: boolean
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          completed_at?: string | null
          course_id?: number | null
          created_at?: string
          created_by: number
          created_by_role?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          owner_id: number
          reason?: string | null
          source?: string
          start_date: string
          start_time?: string | null
          title: string
          updated_at?: string
          visible_to_child?: boolean
        }
        Update: {
          all_day?: boolean
          color?: string | null
          completed_at?: string | null
          course_id?: number | null
          created_at?: string
          created_by?: number
          created_by_role?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          owner_id?: number
          reason?: string | null
          source?: string
          start_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
          visible_to_child?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calia_demo_usage: {
        Row: {
          count: number
          ip: string
          used_at: string
        }
        Insert: {
          count?: number
          ip: string
          used_at?: string
        }
        Update: {
          count?: number
          ip?: string
          used_at?: string
        }
        Relationships: []
      }
      calia_student_profile: {
        Row: {
          behavior_notes: string | null
          last_summary: string | null
          mastered_notions: Json
          method_stats: Json
          preferred_method: string | null
          updated_at: string
          user_id: number
          weak_notions: Json
        }
        Insert: {
          behavior_notes?: string | null
          last_summary?: string | null
          mastered_notions?: Json
          method_stats?: Json
          preferred_method?: string | null
          updated_at?: string
          user_id: number
          weak_notions?: Json
        }
        Update: {
          behavior_notes?: string | null
          last_summary?: string | null
          mastered_notions?: Json
          method_stats?: Json
          preferred_method?: string | null
          updated_at?: string
          user_id?: number
          weak_notions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "calia_student_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calia_student_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_chapter_plan: {
        Row: {
          attempts: number
          chapter_description: string | null
          chapter_focus: string | null
          chapter_name: string
          chapter_order: number
          created_at: string
          folder_id: number
          grade_level: string
          id: number
          last_error: string | null
          length_guidance: string | null
          level_name: string
          planned_lessons: Json | null
          program_version: string | null
          source_lessons: Json
          status: string
          theme_name: string
          theme_order: number
          tone: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          chapter_description?: string | null
          chapter_focus?: string | null
          chapter_name: string
          chapter_order: number
          created_at?: string
          folder_id: number
          grade_level: string
          id?: number
          last_error?: string | null
          length_guidance?: string | null
          level_name: string
          planned_lessons?: Json | null
          program_version?: string | null
          source_lessons: Json
          status?: string
          theme_name: string
          theme_order: number
          tone?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          chapter_description?: string | null
          chapter_focus?: string | null
          chapter_name?: string
          chapter_order?: number
          created_at?: string
          folder_id?: number
          grade_level?: string
          id?: number
          last_error?: string | null
          length_guidance?: string | null
          level_name?: string
          planned_lessons?: Json | null
          program_version?: string | null
          source_lessons?: Json
          status?: string
          theme_name?: string
          theme_order?: number
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_import_queue: {
        Row: {
          attempts: number
          chapter_description: string | null
          chapter_focus: string | null
          chapter_name: string | null
          chapter_order: number | null
          course_id: number | null
          created_at: string
          folder_id: number
          grade_level: string
          id: number
          is_number_intro: boolean
          is_theme_summary: boolean
          last_error: string | null
          length_guidance: string | null
          lesson_order: number
          lesson_role: string | null
          lesson_type: string
          level_name: string
          max_exercises: number
          min_exercises: number
          mini_description: string | null
          program_version: string | null
          slug: string
          status: string
          theme_name: string
          theme_order: number
          title: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          chapter_description?: string | null
          chapter_focus?: string | null
          chapter_name?: string | null
          chapter_order?: number | null
          course_id?: number | null
          created_at?: string
          folder_id: number
          grade_level: string
          id?: number
          is_number_intro?: boolean
          is_theme_summary?: boolean
          last_error?: string | null
          length_guidance?: string | null
          lesson_order: number
          lesson_role?: string | null
          lesson_type: string
          level_name: string
          max_exercises?: number
          min_exercises?: number
          mini_description?: string | null
          program_version?: string | null
          slug: string
          status?: string
          theme_name: string
          theme_order: number
          title: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          chapter_description?: string | null
          chapter_focus?: string | null
          chapter_name?: string | null
          chapter_order?: number | null
          course_id?: number | null
          created_at?: string
          folder_id?: number
          grade_level?: string
          id?: number
          is_number_intro?: boolean
          is_theme_summary?: boolean
          last_error?: string | null
          length_guidance?: string | null
          lesson_order?: number
          lesson_role?: string | null
          lesson_type?: string
          level_name?: string
          max_exercises?: number
          min_exercises?: number
          mini_description?: string | null
          program_version?: string | null
          slug?: string
          status?: string
          theme_name?: string
          theme_order?: number
          title?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      child_ai_analysis_cache: {
        Row: {
          analysis: string
          child_id: number
          generated_at: string
          stats: Json
        }
        Insert: {
          analysis: string
          child_id: number
          generated_at?: string
          stats: Json
        }
        Update: {
          analysis?: string
          child_id?: number
          generated_at?: string
          stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "child_ai_analysis_cache_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_ai_analysis_cache_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generations: {
        Row: {
          admin_id: number
          created_at: string
          error: string | null
          game_type: string | null
          id: string
          kind: string
          params: Json
          progress: Json
          result_json: Json | null
          status: string
          target_id: number | null
          updated_at: string
        }
        Insert: {
          admin_id: number
          created_at?: string
          error?: string | null
          game_type?: string | null
          id?: string
          kind: string
          params?: Json
          progress?: Json
          result_json?: Json | null
          status?: string
          target_id?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: number
          created_at?: string
          error?: string | null
          game_type?: string | null
          id?: string
          kind?: string
          params?: Json
          progress?: Json
          result_json?: Json | null
          status?: string
          target_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      content_previews: {
        Row: {
          admin_id: number
          created_at: string
          id: string
          payload: Json
          type: string
        }
        Insert: {
          admin_id: number
          created_at?: string
          id?: string
          payload: Json
          type: string
        }
        Update: {
          admin_id?: number
          created_at?: string
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_previews_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_previews_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_folders: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: number | null
          description: string | null
          display_order: number | null
          grade_level: string | null
          icon: string | null
          id: number
          is_public: boolean | null
          is_system: boolean
          name: string
          parent_id: number | null
          status: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_public?: boolean | null
          is_system?: boolean
          name: string
          parent_id?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_public?: boolean | null
          is_system?: boolean
          name?: string
          parent_id?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      course_generation_queue: {
        Row: {
          additional_info: string | null
          attempts: number
          course_id: number | null
          created_at: string
          folder_id: number
          grade_level: string
          id: number
          last_error: string | null
          lessons_per_chapter: number | null
          page_count: number | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
          attempts?: number
          course_id?: number | null
          created_at?: string
          folder_id: number
          grade_level: string
          id?: number
          last_error?: string | null
          lessons_per_chapter?: number | null
          page_count?: number | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
          attempts?: number
          course_id?: number | null
          created_at?: string
          folder_id?: number
          grade_level?: string
          id?: number
          last_error?: string | null
          lessons_per_chapter?: number | null
          page_count?: number | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          chapter_name: string | null
          chapter_order: number | null
          content: string | null
          content_json: Json | null
          created_at: string | null
          created_by: number | null
          description: string | null
          difficulty_level: string | null
          estimated_duration: number | null
          estimated_time: number | null
          folder_id: number | null
          generation_id: string | null
          grade_level: string | null
          id: number
          is_published: boolean | null
          is_theme_summary: boolean
          lesson_count: number | null
          lesson_order: number | null
          level: string | null
          points_reward: number | null
          slug: string | null
          status: string | null
          subject: string | null
          theme_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          chapter_name?: string | null
          chapter_order?: number | null
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          generation_id?: string | null
          grade_level?: string | null
          id?: number
          is_published?: boolean | null
          is_theme_summary?: boolean
          lesson_count?: number | null
          lesson_order?: number | null
          level?: string | null
          points_reward?: number | null
          slug?: string | null
          status?: string | null
          subject?: string | null
          theme_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          chapter_name?: string | null
          chapter_order?: number | null
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          generation_id?: string | null
          grade_level?: string | null
          id?: number
          is_published?: boolean | null
          is_theme_summary?: boolean
          lesson_count?: number | null
          lesson_order?: number | null
          level?: string | null
          points_reward?: number | null
          slug?: string | null
          status?: string | null
          subject?: string | null
          theme_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "course_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          created_at: string
          downloaded_at: string | null
          expires_at: string
          id: number
          token_hash: string
          user_id: number
        }
        Insert: {
          created_at?: string
          downloaded_at?: string | null
          expires_at: string
          id?: number
          token_hash: string
          user_id: number
        }
        Update: {
          created_at?: string
          downloaded_at?: string | null
          expires_at?: string
          id?: number
          token_hash?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: number
          is_deletable: boolean | null
          key: string | null
          last_sent_at: string | null
          name: string
          schedule: string | null
          sent_count: number | null
          subject: string
          target: string
          type: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: never
          is_deletable?: boolean | null
          key?: string | null
          last_sent_at?: string | null
          name: string
          schedule?: string | null
          sent_count?: number | null
          subject: string
          target?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: never
          is_deletable?: boolean | null
          key?: string | null
          last_sent_at?: string | null
          name?: string
          schedule?: string | null
          sent_count?: number | null
          subject?: string
          target?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          count: number
          fingerprint: string
          first_seen: string
          id: number
          last_seen: string
          message: string
          resolved: boolean
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: number | null
        }
        Insert: {
          count?: number
          fingerprint: string
          first_seen?: string
          id?: number
          last_seen?: string
          message: string
          resolved?: boolean
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Update: {
          count?: number
          fingerprint?: string
          first_seen?: string
          id?: number
          last_seen?: string
          message?: string
          resolved?: boolean
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_folders: {
        Row: {
          color: string | null
          course_id: number | null
          created_at: string | null
          created_by: number | null
          description: string | null
          display_order: number | null
          grade_level: string | null
          icon: string | null
          id: number
          is_public: boolean | null
          is_system: boolean
          name: string
          parent_id: number | null
          status: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          course_id?: number | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_public?: boolean | null
          is_system?: boolean
          name: string
          parent_id?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          course_id?: number | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_public?: boolean | null
          is_system?: boolean
          name?: string
          parent_id?: number | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "exercise_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          ai_generated: boolean | null
          category: string | null
          content: Json | null
          content_json: Json | null
          course_id: number | null
          created_at: string | null
          created_by: number | null
          description: string | null
          difficulty_level: string | null
          display_order: number | null
          estimated_time: number | null
          folder_id: number | null
          grade_level: string | null
          grading_rubric: Json | null
          grading_type: string | null
          id: number
          instruction: string | null
          is_published: boolean | null
          level: string | null
          max_attempts: number | null
          min_score_percent: number | null
          points_reward: number | null
          question: string | null
          slug: string | null
          solution: Json | null
          solution_text: string | null
          status: string | null
          subject: string | null
          thumbnail_url: string | null
          time_limit: number | null
          time_limit_minutes: number | null
          title: string
          type: string
          updated_at: string | null
          user_prompt: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          category?: string | null
          content?: Json | null
          content_json?: Json | null
          course_id?: number | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          difficulty_level?: string | null
          display_order?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          grade_level?: string | null
          grading_rubric?: Json | null
          grading_type?: string | null
          id?: number
          instruction?: string | null
          is_published?: boolean | null
          level?: string | null
          max_attempts?: number | null
          min_score_percent?: number | null
          points_reward?: number | null
          question?: string | null
          slug?: string | null
          solution?: Json | null
          solution_text?: string | null
          status?: string | null
          subject?: string | null
          thumbnail_url?: string | null
          time_limit?: number | null
          time_limit_minutes?: number | null
          title: string
          type: string
          updated_at?: string | null
          user_prompt?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          category?: string | null
          content?: Json | null
          content_json?: Json | null
          course_id?: number | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          difficulty_level?: string | null
          display_order?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          grade_level?: string | null
          grading_rubric?: Json | null
          grading_type?: string | null
          id?: number
          instruction?: string | null
          is_published?: boolean | null
          level?: string | null
          max_attempts?: number | null
          min_score_percent?: number | null
          points_reward?: number | null
          question?: string | null
          slug?: string | null
          solution?: Json | null
          solution_text?: string | null
          status?: string | null
          subject?: string | null
          thumbnail_url?: string | null
          time_limit?: number | null
          time_limit_minutes?: number | null
          title?: string
          type?: string
          updated_at?: string | null
          user_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "exercise_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          message: string | null
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          message?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          message?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          admin_only: boolean
          audience: string
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: number
          name: string
          order_index: number | null
        }
        Insert: {
          admin_only?: boolean
          audience?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: number
          name: string
          order_index?: number | null
        }
        Update: {
          admin_only?: boolean
          audience?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: number
          name?: string
          order_index?: number | null
        }
        Relationships: []
      }
      forum_comments: {
        Row: {
          author_id: number | null
          content: string
          created_at: string | null
          id: number
          like_count: number
          post_id: number | null
          quoted_comment_id: number | null
          updated_at: string | null
        }
        Insert: {
          author_id?: number | null
          content: string
          created_at?: string | null
          id?: number
          like_count?: number
          post_id?: number | null
          quoted_comment_id?: number | null
          updated_at?: string | null
        }
        Update: {
          author_id?: number | null
          content?: string
          created_at?: string | null
          id?: number
          like_count?: number
          post_id?: number | null
          quoted_comment_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_quoted_comment_id_fkey"
            columns: ["quoted_comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_follows: {
        Row: {
          created_at: string
          post_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_follows_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_likes: {
        Row: {
          comment_id: number | null
          created_at: string
          id: number
          post_id: number | null
          user_id: number
        }
        Insert: {
          comment_id?: number | null
          created_at?: string
          id?: number
          post_id?: number | null
          user_id: number
        }
        Update: {
          comment_id?: number | null
          created_at?: string
          id?: number
          post_id?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_id: number | null
          category_id: number | null
          comment_count: number
          content: string
          created_at: string | null
          id: number
          is_locked: boolean | null
          is_pinned: boolean | null
          last_activity_at: string
          like_count: number
          solved_comment_id: number | null
          title: string
          updated_at: string | null
          view_count: number
        }
        Insert: {
          author_id?: number | null
          category_id?: number | null
          comment_count?: number
          content: string
          created_at?: string | null
          id?: number
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string
          like_count?: number
          solved_comment_id?: number | null
          title: string
          updated_at?: string | null
          view_count?: number
        }
        Update: {
          author_id?: number | null
          category_id?: number | null
          comment_count?: number
          content?: string
          created_at?: string | null
          id?: number
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string
          like_count?: number
          solved_comment_id?: number | null
          title?: string
          updated_at?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_solved_comment_id_fkey"
            columns: ["solved_comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reports: {
        Row: {
          comment_id: number | null
          created_at: string | null
          id: number
          post_id: number | null
          reason: string
          reported_user_id: number | null
          reporter_id: number | null
          status: string
        }
        Insert: {
          comment_id?: number | null
          created_at?: string | null
          id?: number
          post_id?: number | null
          reason: string
          reported_user_id?: number | null
          reporter_id?: number | null
          status?: string
        }
        Update: {
          comment_id?: number | null
          created_at?: string | null
          id?: number
          post_id?: number | null
          reason?: string
          reported_user_id?: number | null
          reporter_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_calendar_events: {
        Row: {
          created_at: string
          created_by: number | null
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          import_key: string | null
          start_date: string
          title: string
          updated_at: string
          zone: string
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          import_key?: string | null
          start_date: string
          title: string
          updated_at?: string
          zone?: string
        }
        Update: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          import_key?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_promotion_runs: {
        Row: {
          id: number
          run_at: string
          run_by: number | null
          undone_at: string | null
        }
        Insert: {
          id?: number
          run_at?: string
          run_by?: number | null
          undone_at?: string | null
        }
        Update: {
          id?: number
          run_at?: string
          run_by?: number | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_promotion_runs_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_promotion_runs_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_promotion_snapshots: {
        Row: {
          id: number
          previous_extra_levels: string[] | null
          previous_grade_level: string | null
          previous_needs_grade_choice: boolean | null
          previous_specialties_chosen_at: string | null
          run_id: number
          user_id: number
        }
        Insert: {
          id?: number
          previous_extra_levels?: string[] | null
          previous_grade_level?: string | null
          previous_needs_grade_choice?: boolean | null
          previous_specialties_chosen_at?: string | null
          run_id: number
          user_id: number
        }
        Update: {
          id?: number
          previous_extra_levels?: string[] | null
          previous_grade_level?: string | null
          previous_needs_grade_choice?: boolean | null
          previous_specialties_chosen_at?: string | null
          run_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_promotion_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "grade_promotion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_promotion_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_promotion_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      graded_answers: {
        Row: {
          block_id: string
          graded_at: string
          is_correct: boolean
          item_id: string
          kind: string
          max_score: number
          score: number
          user_id: number
        }
        Insert: {
          block_id: string
          graded_at?: string
          is_correct?: boolean
          item_id: string
          kind: string
          max_score?: number
          score?: number
          user_id: number
        }
        Update: {
          block_id?: string
          graded_at?: string
          is_correct?: boolean
          item_id?: string
          kind?: string
          max_score?: number
          score?: number
          user_id?: number
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          admin_id: number
          created_at: string
          id: string
          origin_refresh_token: string
          return_to: string
          target_id: number
          target_name: string
        }
        Insert: {
          admin_id: number
          created_at?: string
          id?: string
          origin_refresh_token: string
          return_to: string
          target_id: number
          target_name: string
        }
        Update: {
          admin_id?: number
          created_at?: string
          id?: string
          origin_refresh_token?: string
          return_to?: string
          target_id?: number
          target_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          id: string
          sections: Json
          slug: string
          subtitle: string
          title: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          sections?: Json
          slug: string
          subtitle?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          sections?: Json
          slug?: string
          subtitle?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      manual_reviews: {
        Row: {
          country: string | null
          created_at: string
          display_order: number
          id: string
          is_verified: boolean
          name: string
          published_at: string | null
          rating: number
          review_text: string
          title: string | null
          total_reviews: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_verified?: boolean
          name: string
          published_at?: string | null
          rating: number
          review_text: string
          title?: string | null
          total_reviews?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_verified?: boolean
          name?: string
          published_at?: string | null
          rating?: number
          review_text?: string
          title?: string | null
          total_reviews?: number
        }
        Relationships: []
      }
      math_keyboards: {
        Row: {
          config: Json
          created_at: string
          id: number
          label: string
          level: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: never
          label: string
          level: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: never
          label?: string
          level?: string
          updated_at?: string
        }
        Relationships: []
      }
      minigame_daily_sheets: {
        Row: {
          archived_at: string | null
          created_at: string
          for_date: string
          game_type: string
          id: string
          is_archived: boolean
          language: string | null
          palier_code: string
          questions: Json
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          for_date: string
          game_type?: string
          id?: string
          is_archived?: boolean
          language?: string | null
          palier_code: string
          questions: Json
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          for_date?: string
          game_type?: string
          id?: string
          is_archived?: boolean
          language?: string | null
          palier_code?: string
          questions?: Json
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      minigame_sessions: {
        Row: {
          answer_json: Json | null
          completed_at: string | null
          content_json: Json
          created_at: string
          duration_seconds: number | null
          game_type: string
          grade_level: string
          id: string
          max_score: number | null
          score: number
          status: string
          user_id: number
        }
        Insert: {
          answer_json?: Json | null
          completed_at?: string | null
          content_json: Json
          created_at?: string
          duration_seconds?: number | null
          game_type: string
          grade_level: string
          id?: string
          max_score?: number | null
          score?: number
          status?: string
          user_id: number
        }
        Update: {
          answer_json?: Json | null
          completed_at?: string | null
          content_json?: Json
          created_at?: string
          duration_seconds?: number | null
          game_type?: string
          grade_level?: string
          id?: string
          max_score?: number | null
          score?: number
          status?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "minigame_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_alert_prefs: {
        Row: {
          chapter: boolean
          email: boolean
          goals: boolean
          inactivity: boolean
          inactivity_days: number
          updated_at: string
          user_id: number
        }
        Insert: {
          chapter?: boolean
          email?: boolean
          goals?: boolean
          inactivity?: boolean
          inactivity_days?: number
          updated_at?: string
          user_id: number
        }
        Update: {
          chapter?: boolean
          email?: boolean
          goals?: boolean
          inactivity?: boolean
          inactivity_days?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "parent_alert_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_alert_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          created_at: string
          data: Json
          token: string
        }
        Insert: {
          created_at?: string
          data?: Json
          token?: string
        }
        Update: {
          created_at?: string
          data?: Json
          token?: string
        }
        Relationships: []
      }
      placement_quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          grade_level: string
          id: number
          notion: string | null
          options: Json
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          grade_level: string
          id?: never
          notion?: string | null
          options: Json
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          grade_level?: string
          id?: never
          notion?: string | null
          options?: Json
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      programme_pdfs: {
        Row: {
          custom_content: string | null
          file_name: string | null
          file_url: string
          id: string
          level: string
          level_label: string | null
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          custom_content?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          level: string
          level_label?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          custom_content?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          level?: string
          level_label?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
      quiz_folders: {
        Row: {
          color: string | null
          course_id: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          grade_level: string | null
          icon: string | null
          id: number
          is_system: boolean
          name: string
          parent_id: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          course_id?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_system?: boolean
          name: string
          parent_id?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          course_id?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          grade_level?: string | null
          icon?: string | null
          id?: number
          is_system?: boolean
          name?: string
          parent_id?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_folders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "quiz_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          ai_generated: boolean | null
          content_json: Json | null
          course_id: number | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          display_order: number | null
          estimated_time: number | null
          folder_id: number | null
          grading_rubric: Json | null
          grading_type: string | null
          id: number
          level: string | null
          max_attempts: number | null
          min_score_percent: number | null
          status: string | null
          thumbnail_filename: string | null
          time_limit_minutes: number | null
          title: string
          type: string | null
          updated_at: string | null
          user_prompt: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          content_json?: Json | null
          course_id?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          display_order?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          grading_rubric?: Json | null
          grading_type?: string | null
          id?: number
          level?: string | null
          max_attempts?: number | null
          min_score_percent?: number | null
          status?: string | null
          thumbnail_filename?: string | null
          time_limit_minutes?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_prompt?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          content_json?: Json | null
          course_id?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          display_order?: number | null
          estimated_time?: number | null
          folder_id?: number | null
          grading_rubric?: Json | null
          grading_type?: string | null
          id?: number
          level?: string | null
          max_attempts?: number | null
          min_score_percent?: number | null
          status?: string | null
          thumbnail_filename?: string | null
          time_limit_minutes?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "quiz_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          count: number
          key: string
          overflow_count: number
          reset_at: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          key: string
          overflow_count?: number
          reset_at: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          key?: string
          overflow_count?: number
          reset_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: number
          is_active: boolean
          max_uses: number | null
          owner_user_id: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: number
          is_active?: boolean
          max_uses?: number | null
          owner_user_id?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: number
          is_active?: boolean
          max_uses?: number | null
          owner_user_id?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_uses: {
        Row: {
          confirmed_paid: boolean
          discount_applied: number | null
          id: number
          referral_code_id: number
          subscription_id: number | null
          used_at: string | null
          used_by_user_id: number | null
        }
        Insert: {
          confirmed_paid?: boolean
          discount_applied?: number | null
          id?: number
          referral_code_id: number
          subscription_id?: number | null
          used_at?: string | null
          used_by_user_id?: number | null
        }
        Update: {
          confirmed_paid?: boolean
          discount_applied?: number | null
          id?: number
          referral_code_id?: number
          subscription_id?: number | null
          used_at?: string | null
          used_by_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_uses_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_uses_used_by_user_id_fkey"
            columns: ["used_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_uses_used_by_user_id_fkey"
            columns: ["used_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_findings: {
        Row: {
          created_at: string
          description: string
          file_path: string
          id: string
          run_id: string
          severity: string
          status: string
          suggested_fix: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          file_path: string
          id?: string
          run_id: string
          severity: string
          status?: string
          suggested_fix?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          file_path?: string
          id?: string
          run_id?: string
          severity?: string
          status?: string
          suggested_fix?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_runs: {
        Row: {
          admin_id: number
          category: string
          created_at: string
          error: string | null
          findings_count: number
          id: string
          progress: Json
          status: string
          updated_at: string
        }
        Insert: {
          admin_id: number
          category: string
          created_at?: string
          error?: string | null
          findings_count?: number
          id?: string
          progress?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: number
          category?: string
          created_at?: string
          error?: string | null
          findings_count?: number
          id?: string
          progress?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_runs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_runs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      srs_items: {
        Row: {
          block: string
          box: number
          created_at: string
          due: string
          kind: string
          last_day: string
          misses: number
          ref: string
          user_id: number
        }
        Insert: {
          block: string
          box?: number
          created_at?: string
          due: string
          kind: string
          last_day: string
          misses?: number
          ref: string
          user_id: number
        }
        Update: {
          block?: string
          box?: number
          created_at?: string
          due?: string
          kind?: string
          last_day?: string
          misses?: number
          ref?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "srs_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srs_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_visits: {
        Row: {
          day: string
          path: string
          source: string
          visits: number
        }
        Insert: {
          day: string
          path: string
          source: string
          visits?: number
        }
        Update: {
          day?: string
          path?: string
          source?: string
          visits?: number
        }
        Relationships: []
      }
      stripe_processed_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      student_meta: {
        Row: {
          alert_goal_day: string | null
          alert_inactive_since: string | null
          alert_streak_milestone: number
          alert_weekly_target_week: string | null
          share_version: number
          srs_mastered: number
          updated_at: string
          user_id: number
        }
        Insert: {
          alert_goal_day?: string | null
          alert_inactive_since?: string | null
          alert_streak_milestone?: number
          alert_weekly_target_week?: string | null
          share_version?: number
          srs_mastered?: number
          updated_at?: string
          user_id: number
        }
        Update: {
          alert_goal_day?: string | null
          alert_inactive_since?: string | null
          alert_streak_milestone?: number
          alert_weekly_target_week?: string | null
          share_version?: number
          srs_mastered?: number
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_meta_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_meta_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_prefs: {
        Row: {
          daily_goal: number
          exam_date: string | null
          quiet_enabled: boolean
          quiet_end: string
          quiet_override_until: string | null
          quiet_start: string
          updated_at: string
          user_id: number
          weekly_target: number | null
        }
        Insert: {
          daily_goal?: number
          exam_date?: string | null
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_override_until?: string | null
          quiet_start?: string
          updated_at?: string
          user_id: number
          weekly_target?: number | null
        }
        Update: {
          daily_goal?: number
          exam_date?: string | null
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_override_until?: string | null
          quiet_start?: string
          updated_at?: string
          user_id?: number
          weekly_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_review_days: {
        Row: {
          count: number
          day: string
          user_id: number
        }
        Insert: {
          count?: number
          day: string
          user_id: number
        }
        Update: {
          count?: number
          day?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_review_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_review_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: string
          description: string | null
          features: Json | null
          id: number
          is_active: boolean | null
          name: string
          price: number
          price_monthly: number | null
          price_yearly: number | null
          promo_description: string | null
          sort_order: number | null
          stripe_price_id: string | null
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          billing_interval?: string
          description?: string | null
          features?: Json | null
          id?: number
          is_active?: boolean | null
          name: string
          price?: number
          price_monthly?: number | null
          price_yearly?: number | null
          promo_description?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_interval?: string
          description?: string | null
          features?: Json | null
          id?: number
          is_active?: boolean | null
          name?: string
          price?: number
          price_monthly?: number | null
          price_yearly?: number | null
          promo_description?: string | null
          sort_order?: number | null
          stripe_price_id?: string | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_withdrawals: {
        Row: {
          contract_start: string
          id: number
          plan_id: string | null
          refund_cents: number
          refund_ids: string[]
          requested_at: string
          stripe_subscription_id: string
          user_id: string
        }
        Insert: {
          contract_start: string
          id?: never
          plan_id?: string | null
          refund_cents?: number
          refund_ids?: string[]
          requested_at?: string
          stripe_subscription_id: string
          user_id: string
        }
        Update: {
          contract_start?: string
          id?: never
          plan_id?: string | null
          refund_cents?: number
          refund_ids?: string[]
          requested_at?: string
          stripe_subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          has_paid: boolean
          id: number
          plan_id: string
          renewal_reminder_for: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          has_paid?: boolean
          id?: number
          plan_id: string
          renewal_reminder_for?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          has_paid?: boolean
          id?: number
          plan_id?: string
          renewal_reminder_for?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          created_at: string | null
          id: number
          is_archived: boolean | null
          message: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: number
          is_archived?: boolean | null
          message: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: number
          is_archived?: boolean | null
          message?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          admin_name: string | null
          author_name: string | null
          id: number
          is_admin: boolean | null
          replied_at: string | null
          reply_message: string
          ticket_id: number | null
        }
        Insert: {
          admin_name?: string | null
          author_name?: string | null
          id?: number
          is_admin?: boolean | null
          replied_at?: string | null
          reply_message: string
          ticket_id?: number | null
        }
        Update: {
          admin_name?: string | null
          author_name?: string | null
          id?: number
          is_admin?: boolean | null
          replied_at?: string | null
          reply_message?: string
          ticket_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: number
          used_at: string | null
          user_id: number
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id: number
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: number
          user_id: number
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: number
          user_id: number
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "two_factor_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          token_hash: string
          user_agent: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: number
          token_hash: string
          user_agent?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: number
          token_hash?: string
          user_agent?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "two_factor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_totp: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: number
          secret: string
          user_id: number
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: number
          secret: string
          user_id: number
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: number
          secret?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "two_factor_totp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "two_factor_totp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_interactions: {
        Row: {
          completion_tokens: number | null
          context_id: number | null
          context_type: string | null
          created_at: string | null
          duration_seconds: number | null
          feature_type: string
          id: number
          prompt_tokens: number | null
          user_id: number | null
        }
        Insert: {
          completion_tokens?: number | null
          context_id?: number | null
          context_type?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          feature_type: string
          id?: number
          prompt_tokens?: number | null
          user_id?: number | null
        }
        Update: {
          completion_tokens?: number | null
          context_id?: number | null
          context_type?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          feature_type?: string
          id?: number
          prompt_tokens?: number | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ai_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: number | null
          earned_at: string | null
          id: number
          user_id: number | null
        }
        Insert: {
          badge_id?: number | null
          earned_at?: string | null
          id?: number
          user_id?: number | null
        }
        Update: {
          badge_id?: number | null
          earned_at?: string | null
          id?: number
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cosmetics: {
        Row: {
          cosmetic_key: string
          id: number
          unlocked_at: string | null
          user_id: number
        }
        Insert: {
          cosmetic_key: string
          id?: number
          unlocked_at?: string | null
          user_id: number
        }
        Update: {
          cosmetic_key?: string
          id?: number
          unlocked_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_cosmetics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cosmetics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_course_progress: {
        Row: {
          chapter_index: number
          completed_at: string
          course_id: number
          created_at: string | null
          id: string
          progress_json: Json | null
          status: string
          user_id: number
        }
        Insert: {
          chapter_index: number
          completed_at?: string
          course_id: number
          created_at?: string | null
          id?: string
          progress_json?: Json | null
          status?: string
          user_id: number
        }
        Update: {
          chapter_index?: number
          completed_at?: string
          course_id?: number
          created_at?: string | null
          id?: string
          progress_json?: Json | null
          status?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_course_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_course_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          auth_id: string
          device_id: string
          first_seen_at: string
          id: string
          label: string | null
          last_active_at: string
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth_id: string
          device_id: string
          first_seen_at?: string
          id?: string
          label?: string | null
          last_active_at?: string
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_id?: string
          device_id?: string
          first_seen_at?: string
          id?: string
          label?: string | null
          last_active_at?: string
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      user_exercise_attempts: {
        Row: {
          attempt_started_at: string | null
          attempted_at: string | null
          attempts_history: Json | null
          completed_at: string
          created_at: string | null
          exercise_id: number
          id: string
          is_correct: boolean | null
          passed: boolean | null
          progress_json: Json | null
          score: number
          score_percent: number | null
          status: string
          total_points: number
          user_id: number
        }
        Insert: {
          attempt_started_at?: string | null
          attempted_at?: string | null
          attempts_history?: Json | null
          completed_at?: string
          created_at?: string | null
          exercise_id: number
          id?: string
          is_correct?: boolean | null
          passed?: boolean | null
          progress_json?: Json | null
          score: number
          score_percent?: number | null
          status?: string
          total_points: number
          user_id: number
        }
        Update: {
          attempt_started_at?: string | null
          attempted_at?: string | null
          attempts_history?: Json | null
          completed_at?: string
          created_at?: string | null
          exercise_id?: number
          id?: string
          is_correct?: boolean | null
          passed?: boolean | null
          progress_json?: Json | null
          score?: number
          score_percent?: number | null
          status?: string
          total_points?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_history: {
        Row: {
          city: string | null
          country: string | null
          device_type: string | null
          id: number
          ip: string | null
          latitude: number | null
          logged_at: string
          logged_out_at: string | null
          logout_city: string | null
          logout_country: string | null
          logout_ip: string | null
          logout_latitude: number | null
          logout_longitude: number | null
          longitude: number | null
          user_agent: string | null
          user_id: number
        }
        Insert: {
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: number
          ip?: string | null
          latitude?: number | null
          logged_at?: string
          logged_out_at?: string | null
          logout_city?: string | null
          logout_country?: string | null
          logout_ip?: string | null
          logout_latitude?: number | null
          logout_longitude?: number | null
          longitude?: number | null
          user_agent?: string | null
          user_id: number
        }
        Update: {
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: number
          ip?: string | null
          latitude?: number | null
          logged_at?: string
          logged_out_at?: string | null
          logout_city?: string | null
          logout_country?: string | null
          logout_ip?: string | null
          logout_latitude?: number | null
          logout_longitude?: number | null
          longitude?: number | null
          user_agent?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: number
          is_read: boolean | null
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quiz_attempts: {
        Row: {
          attempt_started_at: string | null
          attempts_history: Json | null
          completed_at: string
          created_at: string | null
          id: string
          passed: boolean | null
          progress_json: Json | null
          quiz_id: number
          score: number
          score_percent: number | null
          status: string
          time_spent_seconds: number
          total_points: number
          total_questions: number | null
          user_id: number
        }
        Insert: {
          attempt_started_at?: string | null
          attempts_history?: Json | null
          completed_at?: string
          created_at?: string | null
          id?: string
          passed?: boolean | null
          progress_json?: Json | null
          quiz_id: number
          score: number
          score_percent?: number | null
          status?: string
          time_spent_seconds: number
          total_points: number
          total_questions?: number | null
          user_id: number
        }
        Update: {
          attempt_started_at?: string | null
          attempts_history?: Json | null
          completed_at?: string
          created_at?: string | null
          id?: string
          passed?: boolean | null
          progress_json?: Json | null
          quiz_id?: number
          score?: number
          score_percent?: number | null
          status?: string
          time_spent_seconds?: number
          total_points?: number
          total_questions?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          auth_session_id: string | null
          device_type: string | null
          duration_seconds: number | null
          id: number
          ip_address: string | null
          last_active_at: string | null
          login_at: string | null
          logout_at: string | null
          user_agent: string | null
          user_id: number | null
        }
        Insert: {
          auth_session_id?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: number
          ip_address?: string | null
          last_active_at?: string | null
          login_at?: string | null
          logout_at?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Update: {
          auth_session_id?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: number
          ip_address?: string | null
          last_active_at?: string | null
          login_at?: string | null
          logout_at?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_type: string | null
          admin_allowed_ips: string[] | null
          admin_level: string | null
          auth_id: string | null
          avatar: string | null
          avatar_border: string | null
          ban_reason: string | null
          ban_until: string | null
          calia_voice: string | null
          cgu_accepted_at: string | null
          child_age: string | null
          child_username: string | null
          created_at: string | null
          device_type: string | null
          email: string | null
          equipped_border: string | null
          extra_levels: string[]
          featured_badges: number[] | null
          first_name: string | null
          grade_level: string | null
          graduated_at: string | null
          has_passkey: boolean
          id: number
          inactivity_warned_at: string | null
          last_active_at: string | null
          last_login_city: string | null
          last_login_country: string | null
          last_login_date: string | null
          last_login_ip: string | null
          last_logout_at: string | null
          last_logout_city: string | null
          last_logout_country: string | null
          last_logout_ip: string | null
          last_name: string | null
          latitude: number | null
          login_count: number
          login_streak: number
          longitude: number | null
          name_animation: string | null
          name_color: string | null
          needs_grade_choice: boolean
          notif_offers_news: boolean | null
          notif_weekly_reports: boolean | null
          onboarding_completed: boolean | null
          onboarding_quiz_score: number | null
          tour_completed: boolean
          email_verified_at: string | null
          referral_free_days: number
          email_verify_token_hash: string | null
          email_verify_expires_at: string | null
          parent_id: number | null
          password_hash: string | null
          pending_discount_percent: number
          role: string
          school_zone: string
          specialties_chosen_at: string | null
          status: string
          subscription_expires_at: string | null
          subscription_plan_id: number | null
          season_preference: string | null
          theme_preference: string | null
          two_factor_enabled: boolean
          two_factor_locked_by_parent: boolean
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          account_type?: string | null
          admin_allowed_ips?: string[] | null
          admin_level?: string | null
          auth_id?: string | null
          avatar?: string | null
          avatar_border?: string | null
          ban_reason?: string | null
          ban_until?: string | null
          calia_voice?: string | null
          cgu_accepted_at?: string | null
          child_age?: string | null
          child_username?: string | null
          created_at?: string | null
          device_type?: string | null
          email?: string | null
          equipped_border?: string | null
          extra_levels?: string[]
          featured_badges?: number[] | null
          first_name?: string | null
          grade_level?: string | null
          graduated_at?: string | null
          has_passkey?: boolean
          id?: number
          inactivity_warned_at?: string | null
          last_active_at?: string | null
          last_login_city?: string | null
          last_login_country?: string | null
          last_login_date?: string | null
          last_login_ip?: string | null
          last_logout_at?: string | null
          last_logout_city?: string | null
          last_logout_country?: string | null
          last_logout_ip?: string | null
          last_name?: string | null
          latitude?: number | null
          login_count?: number
          login_streak?: number
          longitude?: number | null
          name_animation?: string | null
          name_color?: string | null
          needs_grade_choice?: boolean
          notif_offers_news?: boolean | null
          notif_weekly_reports?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_quiz_score?: number | null
          tour_completed?: boolean
          email_verified_at?: string | null
          referral_free_days?: number
          email_verify_token_hash?: string | null
          email_verify_expires_at?: string | null
          parent_id?: number | null
          password_hash?: string | null
          pending_discount_percent?: number
          role: string
          school_zone?: string
          specialties_chosen_at?: string | null
          status?: string
          subscription_expires_at?: string | null
          subscription_plan_id?: number | null
          season_preference?: string | null
          theme_preference?: string | null
          two_factor_enabled?: boolean
          two_factor_locked_by_parent?: boolean
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          account_type?: string | null
          admin_allowed_ips?: string[] | null
          admin_level?: string | null
          auth_id?: string | null
          avatar?: string | null
          avatar_border?: string | null
          ban_reason?: string | null
          ban_until?: string | null
          calia_voice?: string | null
          cgu_accepted_at?: string | null
          child_age?: string | null
          child_username?: string | null
          created_at?: string | null
          device_type?: string | null
          email?: string | null
          equipped_border?: string | null
          extra_levels?: string[]
          featured_badges?: number[] | null
          first_name?: string | null
          grade_level?: string | null
          graduated_at?: string | null
          has_passkey?: boolean
          id?: number
          inactivity_warned_at?: string | null
          last_active_at?: string | null
          last_login_city?: string | null
          last_login_country?: string | null
          last_login_date?: string | null
          last_login_ip?: string | null
          last_logout_at?: string | null
          last_logout_city?: string | null
          last_logout_country?: string | null
          last_logout_ip?: string | null
          last_name?: string | null
          latitude?: number | null
          login_count?: number
          login_streak?: number
          longitude?: number | null
          name_animation?: string | null
          name_color?: string | null
          needs_grade_choice?: boolean
          notif_offers_news?: boolean | null
          notif_weekly_reports?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_quiz_score?: number | null
          tour_completed?: boolean
          email_verified_at?: string | null
          referral_free_days?: number
          email_verify_token_hash?: string | null
          email_verify_expires_at?: string | null
          parent_id?: number | null
          password_hash?: string | null
          pending_discount_percent?: number
          role?: string
          school_zone?: string
          specialties_chosen_at?: string | null
          status?: string
          subscription_expires_at?: string | null
          subscription_plan_id?: number | null
          season_preference?: string | null
          theme_preference?: string | null
          two_factor_enabled?: boolean
          two_factor_locked_by_parent?: boolean
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          type: string
          user_id: number
        }
        Insert: {
          challenge: string
          created_at?: string
          type: string
          user_id: number
        }
        Update: {
          challenge?: string
          created_at?: string
          type?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: number
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: number
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_public_profiles: {
        Row: {
          avatar: string | null
          child_username: string | null
          equipped_border: string | null
          featured_badges: number[] | null
          first_name: string | null
          grade_level: string | null
          id: number | null
          last_name: string | null
          name_color: string | null
          role: string | null
        }
        Insert: {
          avatar?: string | null
          child_username?: string | null
          equipped_border?: string | null
          featured_badges?: number[] | null
          first_name?: string | null
          grade_level?: string | null
          id?: number | null
          last_name?: string | null
          name_color?: string | null
          role?: string | null
        }
        Update: {
          avatar?: string | null
          child_username?: string | null
          equipped_border?: string | null
          featured_badges?: number[] | null
          first_name?: string | null
          grade_level?: string | null
          id?: number | null
          last_name?: string | null
          name_color?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bump_traffic_visit: {
        Args: { p_source: string; p_path: string }
        Returns: undefined
      }
      admin_force_delete_auth_user: {
        Args: { target_auth_id: string }
        Returns: undefined
      }
      admin_item_counts_by_folder: {
        Args: { p_kind: string }
        Returns: {
          folder_id: number
          items: number
        }[]
      }
      admin_item_counts_by_folder_json: {
        Args: { p_kind: string }
        Returns: Json
      }
      admin_minigame_stats: { Args: never; Returns: Json }
      admin_report_stats: { Args: never; Returns: Json }
      bump_review_day: {
        Args: { p_day: string; p_n: number; p_user: number }
        Returns: undefined
      }
      bump_srs_mastered: {
        Args: { p_n: number; p_user: number }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_block_duration_ms?: number
          p_key: string
          p_max_attempts: number
          p_max_failures?: number
          p_window_ms: number
        }
        Returns: {
          allowed: boolean
          blocked: boolean
          blocked_until: string
          remaining: number
          reset_in: number
        }[]
      }
      claim_calia_demo: {
        Args: { p_id: string; p_limit: number }
        Returns: number
      }
      delete_user_account: { Args: { p_auth_id: string }; Returns: undefined }
      find_auth_id_by_email: { Args: { p_email: string }; Returns: string }
      forum_increment_view: { Args: { p_post_id: number }; Returns: undefined }
      get_my_parent_id: { Args: never; Returns: number }
      get_my_user_id: { Args: never; Returns: number }
      list_auth_sessions: {
        Args: { p_auth_id: string }
        Returns: {
          created_at: string
          id: string
          ip: string
          not_after: string
          updated_at: string
          user_agent: string
        }[]
      }
      log_error: {
        Args: {
          p_fingerprint: string
          p_message: string
          p_source: string
          p_stack: string
          p_url: string
          p_user_agent: string
          p_user_id: number
        }
        Returns: boolean
      }
      merge_catalogue_lesson: {
        Args: {
          p_chapter_key: string
          p_chapter_order: number
          p_chapter_title: string
          p_folder_id: number
          p_lesson: Json
          p_level: string
          p_slug: string
          p_subject: string
          p_title: string
        }
        Returns: number
      }
      minigame_leaderboard: {
        Args: {
          p_game_type: string
          p_grade_levels: string[]
          p_limit?: number
          p_me: number
          p_since: string
        }
        Returns: {
          best_duration: number
          rank: number
          total: number
          total_duration: number
          user_id: number
        }[]
      }
      minigame_played_days: {
        Args: { p_games: string[]; p_user: number }
        Returns: Json
      }
      revoke_auth_session: {
        Args: { p_auth_id: string; p_session_id: string }
        Returns: boolean
      }
      strip_html_tags: { Args: { input: string }; Returns: string }
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
