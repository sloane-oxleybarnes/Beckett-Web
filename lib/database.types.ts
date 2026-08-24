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
      adaptive_conversation_sessions: {
        Row: {
          assessment: Json | null
          channel: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          difficulty: string
          id: string
          lifecycle: string
          replay: Json | null
          scenario_type: string
          setup_snapshot: Json
          simulation_state: Json
          status: string
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment?: Json | null
          channel?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          lifecycle?: string
          replay?: Json | null
          scenario_type: string
          setup_snapshot?: Json
          simulation_state?: Json
          status?: string
          transcript?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment?: Json | null
          channel?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          lifecycle?: string
          replay?: Json | null
          scenario_type?: string
          setup_snapshot?: Json
          simulation_state?: Json
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_conversation_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          source: string
          token_estimate: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          token_estimate?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          token_estimate?: number
          user_id?: string
        }
        Relationships: []
      }
      beta_events: {
        Row: {
          created_at: string
          email: string | null
          event_name: string
          id: string
          metadata: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_name: string
          id?: string
          metadata?: Json
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_name?: string
          id?: string
          metadata?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          analysis_result: Json
          comment: string | null
          context_snapshot: Json
          created_at: string
          id: string
          metadata: Json
          mode: string | null
          platform: string | null
          rating: string
          response_text: string | null
          sender: string | null
          sender_email: string | null
          source: string | null
          thread_count: number | null
          user_id: string
        }
        Insert: {
          analysis_result?: Json
          comment?: string | null
          context_snapshot?: Json
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string | null
          platform?: string | null
          rating: string
          response_text?: string | null
          sender?: string | null
          sender_email?: string | null
          source?: string | null
          thread_count?: number | null
          user_id: string
        }
        Update: {
          analysis_result?: Json
          comment?: string | null
          context_snapshot?: Json
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string | null
          platform?: string | null
          rating?: string
          response_text?: string | null
          sender?: string | null
          sender_email?: string | null
          source?: string | null
          thread_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      beta_mission_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          completion_source: string | null
          created_at: string
          feedback_at: string | null
          feedback_comment: string | null
          feedback_rating: string | null
          id: string
          mission_key: string
          position: number
          presented_at: string | null
          skip_reason: string | null
          skipped_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          completion_source?: string | null
          created_at?: string
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          id?: string
          mission_key: string
          position: number
          presented_at?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          completion_source?: string | null
          created_at?: string
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          id?: string
          mission_key?: string
          position?: number
          presented_at?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beta_signups: {
        Row: {
          approved: boolean
          approved_at: string | null
          converted_to_user: boolean | null
          created_at: string | null
          email: string
          hubspot_contact_id: string | null
          id: string
          invite_reminder_sent_at: string | null
          invite_sent_at: string | null
          last_activity_at: string | null
          lifecycle_stage: string
          name: string | null
          plan: string | null
          source: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          converted_to_user?: boolean | null
          created_at?: string | null
          email: string
          hubspot_contact_id?: string | null
          id?: string
          invite_reminder_sent_at?: string | null
          invite_sent_at?: string | null
          last_activity_at?: string | null
          lifecycle_stage?: string
          name?: string | null
          plan?: string | null
          source?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          converted_to_user?: boolean | null
          created_at?: string | null
          email?: string
          hubspot_contact_id?: string | null
          id?: string
          invite_reminder_sent_at?: string | null
          invite_sent_at?: string | null
          last_activity_at?: string | null
          lifecycle_stage?: string
          name?: string | null
          plan?: string | null
          source?: string | null
        }
        Relationships: []
      }
      contact_identifiers: {
        Row: {
          confirmed: boolean
          contact_id: string
          created_at: string | null
          id: string
          identifier: string
          label: string | null
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          contact_id: string
          created_at?: string | null
          id?: string
          identifier: string
          label?: string | null
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed?: boolean
          contact_id?: string
          created_at?: string | null
          id?: string
          identifier?: string
          label?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_identifiers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_insights: {
        Row: {
          common_topics: string | null
          communication_patterns: string | null
          contact_id: string
          generated_at: string | null
          id: string
          responsiveness: string | null
          summary: string | null
          tone_trend: string | null
        }
        Insert: {
          common_topics?: string | null
          communication_patterns?: string | null
          contact_id: string
          generated_at?: string | null
          id?: string
          responsiveness?: string | null
          summary?: string | null
          tone_trend?: string | null
        }
        Update: {
          common_topics?: string | null
          communication_patterns?: string | null
          contact_id?: string
          generated_at?: string | null
          id?: string
          responsiveness?: string | null
          summary?: string | null
          tone_trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_relationship_summaries: {
        Row: {
          communication_style: string | null
          contact_id: string
          created_at: string
          generated_from: string | null
          id: string
          last_interaction_at: string | null
          recurring_tension_points: string | null
          unresolved_topics: string | null
          updated_at: string
          user_id: string
          what_tends_to_work: string | null
        }
        Insert: {
          communication_style?: string | null
          contact_id: string
          created_at?: string
          generated_from?: string | null
          id?: string
          last_interaction_at?: string | null
          recurring_tension_points?: string | null
          unresolved_topics?: string | null
          updated_at?: string
          user_id: string
          what_tends_to_work?: string | null
        }
        Update: {
          communication_style?: string | null
          contact_id?: string
          created_at?: string
          generated_from?: string | null
          id?: string
          last_interaction_at?: string | null
          recurring_tension_points?: string | null
          unresolved_topics?: string | null
          updated_at?: string
          user_id?: string
          what_tends_to_work?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_relationship_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone_number: string | null
          primary_relationship_tag: string | null
          relationship_other: string | null
          relationship_tags: string[]
          relationship_type: string | null
          slack_handle: string | null
          trusted: boolean
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone_number?: string | null
          primary_relationship_tag?: string | null
          relationship_other?: string | null
          relationship_tags?: string[]
          relationship_type?: string | null
          slack_handle?: string | null
          trusted?: boolean
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone_number?: string | null
          primary_relationship_tag?: string | null
          relationship_other?: string | null
          relationship_tags?: string[]
          relationship_type?: string | null
          slack_handle?: string | null
          trusted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      course_completions: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string | null
          id: string
          post_confidence: number | null
          pre_confidence: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          post_confidence?: number | null
          pre_confidence?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          post_confidence?: number | null
          pre_confidence?: number | null
          user_id?: string
        }
        Relationships: []
      }
      course_content: {
        Row: {
          course_id: string
          created_at: string
          draft_json: Json
          illustration: string
          is_listed: boolean
          published_at: string | null
          published_json: Json | null
          section: string
          sort_order: number
          source_course_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          draft_json: Json
          illustration?: string
          is_listed?: boolean
          published_at?: string | null
          published_json?: Json | null
          section?: string
          sort_order?: number
          source_course_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          draft_json?: Json
          illustration?: string
          is_listed?: boolean
          published_at?: string | null
          published_json?: Json | null
          section?: string
          sort_order?: number
          source_course_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          activity_state: Json | null
          course_id: string
          created_at: string
          current_slide_index: number
          id: string
          phase: string
          pre_confidence: number | null
          progress_percent: number
          saved_at: string
          user_id: string
        }
        Insert: {
          activity_state?: Json | null
          course_id: string
          created_at?: string
          current_slide_index?: number
          id?: string
          phase: string
          pre_confidence?: number | null
          progress_percent?: number
          saved_at?: string
          user_id: string
        }
        Update: {
          activity_state?: Json | null
          course_id?: string
          created_at?: string
          current_slide_index?: number
          id?: string
          phase?: string
          pre_confidence?: number | null
          progress_percent?: number
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_toolkit_items: {
        Row: {
          category: string
          content: string
          course_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          label: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          content: string
          course_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          label: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          course_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          date: string
          id: string
          mood: string
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          mood: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          mood?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_workspace_addon_link_sessions: {
        Row: {
          created_at: string
          expires_at: string
          google_email: string
          google_subject: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          google_email: string
          google_subject: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          google_email?: string
          google_subject?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      google_workspace_analysis_cache: {
        Row: {
          created_at: string
          expires_at: string
          message_ids: string[]
          sections: Json
          thread_id: string
          thread_revision: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          message_ids?: string[]
          sections: Json
          thread_id: string
          thread_revision: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          message_ids?: string[]
          sections?: Json
          thread_id?: string
          thread_revision?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_workspace_analysis_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_summaries: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          interaction_type: string | null
          metadata: Json
          occurred_at: string | null
          platform: string | null
          suggested_followup: string | null
          summary: string
          tone_observed: string | null
          user_id: string
          user_response_pattern: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          interaction_type?: string | null
          metadata?: Json
          occurred_at?: string | null
          platform?: string | null
          suggested_followup?: string | null
          summary: string
          tone_observed?: string | null
          user_id: string
          user_response_pattern?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          interaction_type?: string | null
          metadata?: Json
          occurred_at?: string | null
          platform?: string | null
          suggested_followup?: string | null
          summary?: string
          tone_observed?: string | null
          user_id?: string
          user_response_pattern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_recommendation_feedback: {
        Row: {
          created_at: string
          evidence: Json
          href: string
          id: string
          reason: string
          recommendation_key: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          href: string
          id?: string
          reason: string
          recommendation_key: string
          status: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          href?: string
          id?: string
          reason?: string
          recommendation_key?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_sessions: {
        Row: {
          attendee_context: string | null
          communication_reminders: string | null
          created_at: string
          decisions: Json
          final_summary: string | null
          follow_up_draft: string | null
          id: string
          open_questions: Json
          pre_meeting_goals: Json
          prep_checklist: Json
          retention_preference: string
          scheduled_at: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          attendee_context?: string | null
          communication_reminders?: string | null
          created_at?: string
          decisions?: Json
          final_summary?: string | null
          follow_up_draft?: string | null
          id?: string
          open_questions?: Json
          pre_meeting_goals?: Json
          prep_checklist?: Json
          retention_preference?: string
          scheduled_at?: string | null
          source?: string
          title: string
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          attendee_context?: string | null
          communication_reminders?: string | null
          created_at?: string
          decisions?: Json
          final_summary?: string | null
          follow_up_draft?: string | null
          id?: string
          open_questions?: Json
          pre_meeting_goals?: Json
          prep_checklist?: Json
          retention_preference?: string
          scheduled_at?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      microsoft_subscriptions: {
        Row: {
          client_state_hash: string
          created_at: string
          expiration_at: string
          id: string
          kind: string
          last_notification_at: string | null
          resource: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_state_hash: string
          created_at?: string
          expiration_at: string
          id: string
          kind: string
          last_notification_at?: string | null
          resource: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_state_hash?: string
          created_at?: string
          expiration_at?: string
          id?: string
          kind?: string
          last_notification_at?: string | null
          resource?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outlook_sso_link_attempts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          microsoft_user_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          microsoft_user_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          microsoft_user_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          conversation_format: string | null
          created_at: string | null
          debrief_summary: Json | null
          goal: string | null
          id: string
          mode: string | null
          person: string | null
          session_data: Json
          situation: string | null
          skill_id: string | null
          status: string
          text_sub_format: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          conversation_format?: string | null
          created_at?: string | null
          debrief_summary?: Json | null
          goal?: string | null
          id?: string
          mode?: string | null
          person?: string | null
          session_data?: Json
          situation?: string | null
          skill_id?: string | null
          status?: string
          text_sub_format?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          conversation_format?: string | null
          created_at?: string | null
          debrief_summary?: Json | null
          goal?: string | null
          id?: string
          mode?: string | null
          person?: string | null
          session_data?: Json
          situation?: string | null
          skill_id?: string | null
          status?: string
          text_sub_format?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adult_us_eligibility_confirmed_at: string | null
          adult_us_eligibility_version: string | null
          coaching_disclaimer_acknowledged_at: string | null
          coaching_disclaimer_version: string | null
          coaching_priority_ratings: Json
          coaching_style_ratings: Json
          coaching_tone: string
          communication_strength_ratings: Json
          communication_preferences: string[] | null
          created_at: string | null
          dashboard_walkthrough_completed_at: string | null
          deletion_notes: string | null
          deletion_requested_at: string | null
          deletion_status: string | null
          desktop_companion_enabled: boolean
          display_name: string | null
          email: string
          extension_connected_at: string | null
          extension_token: string | null
          first_login_complete: boolean
          first_name: string | null
          full_name: string | null
          home_suggestions_enabled: boolean
          hubspot_contact_id: string | null
          id: string
          last_name: string | null
          meeting_consent_reminder_enabled: boolean
          meeting_prep_learning_enabled: boolean
          meeting_prompt_style: string
          meeting_retention_preference: string
          meeting_support_enabled: boolean
          neurodivergent_context: string[] | null
          neurodivergent_context_other: string | null
          onboarding_completed_at: string | null
          pattern_model_enabled: boolean
          plan: string
          privacy_acknowledged_at: string | null
          privacy_version: string | null
          proactive_coaching_preference: string
          role: string
          safety_resource_region: string | null
          skill_recommendations_enabled: boolean
          strengths: string[] | null
          stripe_customer_id: string | null
          team_id: string | null
          team_opt_in: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          workplace_triggers: string[] | null
          workplace_effort_ratings: Json
        }
        Insert: {
          adult_us_eligibility_confirmed_at?: string | null
          adult_us_eligibility_version?: string | null
          coaching_disclaimer_acknowledged_at?: string | null
          coaching_disclaimer_version?: string | null
          coaching_priority_ratings?: Json
          coaching_style_ratings?: Json
          coaching_tone?: string
          communication_strength_ratings?: Json
          communication_preferences?: string[] | null
          created_at?: string | null
          dashboard_walkthrough_completed_at?: string | null
          deletion_notes?: string | null
          deletion_requested_at?: string | null
          deletion_status?: string | null
          desktop_companion_enabled?: boolean
          display_name?: string | null
          email: string
          extension_connected_at?: string | null
          extension_token?: string | null
          first_login_complete?: boolean
          first_name?: string | null
          full_name?: string | null
          home_suggestions_enabled?: boolean
          hubspot_contact_id?: string | null
          id: string
          last_name?: string | null
          meeting_consent_reminder_enabled?: boolean
          meeting_prep_learning_enabled?: boolean
          meeting_prompt_style?: string
          meeting_retention_preference?: string
          meeting_support_enabled?: boolean
          neurodivergent_context?: string[] | null
          neurodivergent_context_other?: string | null
          onboarding_completed_at?: string | null
          pattern_model_enabled?: boolean
          plan?: string
          privacy_acknowledged_at?: string | null
          privacy_version?: string | null
          proactive_coaching_preference?: string
          role?: string
          safety_resource_region?: string | null
          skill_recommendations_enabled?: boolean
          strengths?: string[] | null
          stripe_customer_id?: string | null
          team_id?: string | null
          team_opt_in?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          workplace_triggers?: string[] | null
          workplace_effort_ratings?: Json
        }
        Update: {
          adult_us_eligibility_confirmed_at?: string | null
          adult_us_eligibility_version?: string | null
          coaching_disclaimer_acknowledged_at?: string | null
          coaching_disclaimer_version?: string | null
          coaching_priority_ratings?: Json
          coaching_style_ratings?: Json
          coaching_tone?: string
          communication_strength_ratings?: Json
          communication_preferences?: string[] | null
          created_at?: string | null
          dashboard_walkthrough_completed_at?: string | null
          deletion_notes?: string | null
          deletion_requested_at?: string | null
          deletion_status?: string | null
          desktop_companion_enabled?: boolean
          display_name?: string | null
          email?: string
          extension_connected_at?: string | null
          extension_token?: string | null
          first_login_complete?: boolean
          first_name?: string | null
          full_name?: string | null
          home_suggestions_enabled?: boolean
          hubspot_contact_id?: string | null
          id?: string
          last_name?: string | null
          meeting_consent_reminder_enabled?: boolean
          meeting_prep_learning_enabled?: boolean
          meeting_prompt_style?: string
          meeting_retention_preference?: string
          meeting_support_enabled?: boolean
          neurodivergent_context?: string[] | null
          neurodivergent_context_other?: string | null
          onboarding_completed_at?: string | null
          pattern_model_enabled?: boolean
          plan?: string
          privacy_acknowledged_at?: string | null
          privacy_version?: string | null
          proactive_coaching_preference?: string
          role?: string
          safety_resource_region?: string | null
          skill_recommendations_enabled?: boolean
          strengths?: string[] | null
          stripe_customer_id?: string | null
          team_id?: string | null
          team_opt_in?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          workplace_triggers?: string[] | null
          workplace_effort_ratings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_tag_definitions: {
        Row: {
          created_at: string
          id: string
          label: string
          tag_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          tag_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          tag_key?: string
          user_id?: string
        }
        Relationships: []
      }
      slack_agent_sessions: {
        Row: {
          answers: Json
          coaching_thread_id: string | null
          confirmed_evidence: Json
          created_at: string
          evidence_suggestions: Json
          expires_at: string
          flow_type: string
          id: string
          slack_channel_id: string
          slack_team_id: string
          slack_user_id: string
          status: string
          step: string
          thread_ts: string | null
          updated_at: string
          user_id: string
          zero_copy_flow_session_id: string | null
        }
        Insert: {
          answers?: Json
          coaching_thread_id?: string | null
          confirmed_evidence?: Json
          created_at?: string
          evidence_suggestions?: Json
          expires_at?: string
          flow_type?: string
          id?: string
          slack_channel_id: string
          slack_team_id: string
          slack_user_id: string
          status?: string
          step: string
          thread_ts?: string | null
          updated_at?: string
          user_id: string
          zero_copy_flow_session_id?: string | null
        }
        Update: {
          answers?: Json
          coaching_thread_id?: string | null
          confirmed_evidence?: Json
          created_at?: string
          evidence_suggestions?: Json
          expires_at?: string
          flow_type?: string
          id?: string
          slack_channel_id?: string
          slack_team_id?: string
          slack_user_id?: string
          status?: string
          step?: string
          thread_ts?: string | null
          updated_at?: string
          user_id?: string
          zero_copy_flow_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack_agent_sessions_coaching_thread_id_fkey"
            columns: ["coaching_thread_id"]
            isOneToOne: false
            referencedRelation: "slack_coaching_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_agent_sessions_zero_copy_flow_session_id_fkey"
            columns: ["zero_copy_flow_session_id"]
            isOneToOne: false
            referencedRelation: "slack_flow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_coaching_bot_messages: {
        Row: {
          coaching_thread_id: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string | null
          slack_channel_id: string
          slack_message_ts: string
          user_id: string
        }
        Insert: {
          coaching_thread_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string | null
          slack_channel_id: string
          slack_message_ts: string
          user_id: string
        }
        Update: {
          coaching_thread_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string | null
          slack_channel_id?: string
          slack_message_ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_coaching_bot_messages_coaching_thread_id_fkey"
            columns: ["coaching_thread_id"]
            isOneToOne: false
            referencedRelation: "slack_coaching_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_coaching_messages: {
        Row: {
          coaching_thread_id: string
          content: string
          created_at: string
          id: string
          role: string
          slack_team_id: string
          slack_user_id: string
          user_id: string
        }
        Insert: {
          coaching_thread_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          slack_team_id: string
          slack_user_id: string
          user_id: string
        }
        Update: {
          coaching_thread_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          slack_team_id?: string
          slack_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_coaching_messages_coaching_thread_id_fkey"
            columns: ["coaching_thread_id"]
            isOneToOne: false
            referencedRelation: "slack_coaching_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_coaching_threads: {
        Row: {
          archived_at: string | null
          created_at: string
          flow_type: string
          id: string
          prompt_snippet: string | null
          slack_channel_id: string | null
          slack_team_id: string
          slack_user_id: string
          source_channel_id: string | null
          source_channel_name: string | null
          status: string
          summary: string | null
          thread_ts: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          flow_type: string
          id?: string
          prompt_snippet?: string | null
          slack_channel_id?: string | null
          slack_team_id: string
          slack_user_id: string
          source_channel_id?: string | null
          source_channel_name?: string | null
          status?: string
          summary?: string | null
          thread_ts?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          flow_type?: string
          id?: string
          prompt_snippet?: string | null
          slack_channel_id?: string | null
          slack_team_id?: string
          slack_user_id?: string
          source_channel_id?: string | null
          source_channel_name?: string | null
          status?: string
          summary?: string | null
          thread_ts?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slack_command_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          intent: string
          request_key: string
          scheduled_at: string
          slack_team_id: string
          slack_user_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent: string
          request_key: string
          scheduled_at: string
          slack_team_id: string
          slack_user_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent?: string
          request_key?: string
          scheduled_at?: string
          slack_team_id?: string
          slack_user_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      slack_command_lanes: {
        Row: {
          next_available_at: string
          slack_team_id: string
          slack_user_id: string
          updated_at: string
        }
        Insert: {
          next_available_at?: string
          slack_team_id: string
          slack_user_id: string
          updated_at?: string
        }
        Update: {
          next_available_at?: string
          slack_team_id?: string
          slack_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      slack_credit_reservations: {
        Row: {
          allowance_limit: number
          beckett_user_id: string | null
          committed_at: string | null
          expires_at: string
          id: string
          released_at: string | null
          request_id: string
          reserved_at: string
          slack_team_id: string
          slack_user_id: string
          status: string
        }
        Insert: {
          allowance_limit: number
          beckett_user_id?: string | null
          committed_at?: string | null
          expires_at?: string
          id?: string
          released_at?: string | null
          request_id: string
          reserved_at?: string
          slack_team_id: string
          slack_user_id: string
          status?: string
        }
        Update: {
          allowance_limit?: number
          beckett_user_id?: string | null
          committed_at?: string | null
          expires_at?: string
          id?: string
          released_at?: string | null
          request_id?: string
          reserved_at?: string
          slack_team_id?: string
          slack_user_id?: string
          status?: string
        }
        Relationships: []
      }
      slack_flow_bot_messages: {
        Row: {
          beckett_user_id: string | null
          created_at: string
          deleted_at: string | null
          flow_session_id: string
          id: string
          kind: string | null
          slack_channel_id: string
          slack_message_ts: string
        }
        Insert: {
          beckett_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          flow_session_id: string
          id?: string
          kind?: string | null
          slack_channel_id: string
          slack_message_ts: string
        }
        Update: {
          beckett_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          flow_session_id?: string
          id?: string
          kind?: string | null
          slack_channel_id?: string
          slack_message_ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_flow_bot_messages_flow_session_id_fkey"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "slack_flow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_flow_sessions: {
        Row: {
          archived_at: string | null
          beckett_user_id: string | null
          created_at: string
          current_step: string | null
          expires_at: string | null
          flow_type: string
          id: string
          request_id: string | null
          slack_channel_id: string | null
          slack_message_ts: string | null
          slack_source_channel_id: string | null
          slack_source_message_ts: string | null
          slack_source_thread_ts: string | null
          slack_team_id: string
          slack_thread_ts: string | null
          slack_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          beckett_user_id?: string | null
          created_at?: string
          current_step?: string | null
          expires_at?: string | null
          flow_type?: string
          id?: string
          request_id?: string | null
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_source_channel_id?: string | null
          slack_source_message_ts?: string | null
          slack_source_thread_ts?: string | null
          slack_team_id: string
          slack_thread_ts?: string | null
          slack_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          beckett_user_id?: string | null
          created_at?: string
          current_step?: string | null
          expires_at?: string | null
          flow_type?: string
          id?: string
          request_id?: string | null
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_source_channel_id?: string | null
          slack_source_message_ts?: string | null
          slack_source_thread_ts?: string | null
          slack_team_id?: string
          slack_thread_ts?: string | null
          slack_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      slack_guest_sessions: {
        Row: {
          artifacts: Json
          assistant_channel_id: string
          assistant_thread_ts: string
          created_at: string
          expires_at: string
          flow_type: string
          id: string
          practice_thread_ts: string | null
          slack_team_id: string
          slack_user_id: string
          source: Json
          state: Json
          status: string
          transcript: Json
          updated_at: string
        }
        Insert: {
          artifacts?: Json
          assistant_channel_id: string
          assistant_thread_ts: string
          created_at?: string
          expires_at?: string
          flow_type: string
          id?: string
          practice_thread_ts?: string | null
          slack_team_id: string
          slack_user_id: string
          source?: Json
          state?: Json
          status?: string
          transcript?: Json
          updated_at?: string
        }
        Update: {
          artifacts?: Json
          assistant_channel_id?: string
          assistant_thread_ts?: string
          created_at?: string
          expires_at?: string
          flow_type?: string
          id?: string
          practice_thread_ts?: string | null
          slack_team_id?: string
          slack_user_id?: string
          source?: Json
          state?: Json
          status?: string
          transcript?: Json
          updated_at?: string
        }
        Relationships: []
      }
      slack_guest_usage_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          slack_team_id: string
          slack_user_id: string
          source: string
          token_estimate: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          slack_team_id: string
          slack_user_id: string
          source?: string
          token_estimate?: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          slack_team_id?: string
          slack_user_id?: string
          source?: string
          token_estimate?: number
        }
        Relationships: []
      }
      slack_inactivity_schedules: {
        Row: {
          channel_id: string
          generation: string
          scheduled_message_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          generation: string
          scheduled_message_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          generation?: string
          scheduled_message_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slack_installations: {
        Row: {
          bot_token_expires_at: string | null
          encrypted_bot_access_token: string | null
          encrypted_bot_refresh_token: string | null
          granted_bot_scopes: string[]
          id: string
          installed_at: string
          installer_user_id: string | null
          slack_enterprise_id: string | null
          slack_team_id: string
          uninstalled_at: string | null
          updated_at: string
        }
        Insert: {
          bot_token_expires_at?: string | null
          encrypted_bot_access_token?: string | null
          encrypted_bot_refresh_token?: string | null
          granted_bot_scopes?: string[]
          id?: string
          installed_at?: string
          installer_user_id?: string | null
          slack_enterprise_id?: string | null
          slack_team_id: string
          uninstalled_at?: string | null
          updated_at?: string
        }
        Update: {
          bot_token_expires_at?: string | null
          encrypted_bot_access_token?: string | null
          encrypted_bot_refresh_token?: string | null
          granted_bot_scopes?: string[]
          id?: string
          installed_at?: string
          installer_user_id?: string | null
          slack_enterprise_id?: string | null
          slack_team_id?: string
          uninstalled_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slack_pending_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          prompt: string
          response_url: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
          slack_team_id: string
          slack_user_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          prompt: string
          response_url?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          slack_team_id: string
          slack_user_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          prompt?: string
          response_url?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          slack_team_id?: string
          slack_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      slack_usage_events: {
        Row: {
          beckett_user_id: string | null
          created_at: string
          credits_charged: number
          error_code: string | null
          event_type: string
          flow_type: string | null
          id: string
          latency_ms: number | null
          occurred_at: string
          request_id: string | null
          search_available: boolean | null
          slack_team_id: string
          slack_user_id: string
          success: boolean
        }
        Insert: {
          beckett_user_id?: string | null
          created_at?: string
          credits_charged?: number
          error_code?: string | null
          event_type: string
          flow_type?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          request_id?: string | null
          search_available?: boolean | null
          slack_team_id: string
          slack_user_id: string
          success?: boolean
        }
        Update: {
          beckett_user_id?: string | null
          created_at?: string
          credits_charged?: number
          error_code?: string | null
          event_type?: string
          flow_type?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          request_id?: string | null
          search_available?: boolean | null
          slack_team_id?: string
          slack_user_id?: string
          success?: boolean
        }
        Relationships: []
      }
      slack_user_links: {
        Row: {
          beckett_user_id: string | null
          disconnected_at: string | null
          encrypted_user_access_token: string | null
          encrypted_user_refresh_token: string | null
          granted_user_scopes: string[]
          id: string
          linked_at: string
          slack_team_id: string
          slack_user_id: string
          updated_at: string
          user_token_expires_at: string | null
        }
        Insert: {
          beckett_user_id?: string | null
          disconnected_at?: string | null
          encrypted_user_access_token?: string | null
          encrypted_user_refresh_token?: string | null
          granted_user_scopes?: string[]
          id?: string
          linked_at?: string
          slack_team_id: string
          slack_user_id: string
          updated_at?: string
          user_token_expires_at?: string | null
        }
        Update: {
          beckett_user_id?: string | null
          disconnected_at?: string | null
          encrypted_user_access_token?: string | null
          encrypted_user_refresh_token?: string | null
          granted_user_scopes?: string[]
          id?: string
          linked_at?: string
          slack_team_id?: string
          slack_user_id?: string
          updated_at?: string
          user_token_expires_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          admin_id: string | null
          created_at: string | null
          hubspot_deal_id: string | null
          id: string
          name: string
          plan: string
          seat_count: number
          stripe_subscription_id: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          hubspot_deal_id?: string | null
          id?: string
          name: string
          plan?: string
          seat_count?: number
          stripe_subscription_id?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          hubspot_deal_id?: string | null
          id?: string
          name?: string
          plan?: string
          seat_count?: number
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      upgrade_intents: {
        Row: {
          created_at: string | null
          email: string
          id: string
          target_plan: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          target_plan: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          target_plan?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_about: {
        Row: {
          communication_style: string | null
          created_at: string | null
          how_i_work_best: string | null
          id: string
          triggers: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          communication_style?: string | null
          created_at?: string | null
          how_i_work_best?: string | null
          id?: string
          triggers?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          communication_style?: string | null
          created_at?: string | null
          how_i_work_best?: string | null
          id?: string
          triggers?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_app_preferences: {
        Row: {
          added_source: string
          app_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_source?: string
          app_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_source?: string
          app_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          access_token: string | null
          connected_at: string
          external_team_id: string | null
          external_team_name: string | null
          external_user_id: string | null
          id: string
          metadata: Json
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string
          external_team_id?: string | null
          external_team_name?: string | null
          external_user_id?: string | null
          id?: string
          metadata?: Json
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string
          external_team_id?: string | null
          external_team_name?: string | null
          external_user_id?: string | null
          id?: string
          metadata?: Json
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pattern_observations: {
        Row: {
          archived_at: string | null
          coaching_note: string | null
          confidence: number | null
          created_at: string
          evidence_summary: string | null
          id: string
          label: string
          pattern_key: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          coaching_note?: string | null
          confidence?: number | null
          created_at?: string
          evidence_summary?: string | null
          id?: string
          label: string
          pattern_key: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          coaching_note?: string | null
          confidence?: number | null
          created_at?: string
          evidence_summary?: string | null
          id?: string
          label?: string
          pattern_key?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_course_unlocks: {
        Row: {
          course_id: string
          created_at: string
          id: string
          period_start: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          period_start: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      web_credit_events: {
        Row: {
          action: string
          created_at: string
          credits: number
          id: string
          metadata: Json
          source: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits?: number
          id?: string
          metadata?: Json
          source: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits?: number
          id?: string
          metadata?: Json
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      web_credit_reservations: {
        Row: {
          action: string
          committed_at: string | null
          expires_at: string
          id: string
          metadata: Json
          released_at: string | null
          request_id: string
          reserved_at: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          committed_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
          released_at?: string | null
          request_id: string
          reserved_at?: string
          source: string
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          committed_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
          released_at?: string | null
          request_id?: string
          reserved_at?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      workday_checkins: {
        Row: {
          break_status: string
          calendar_context: Json
          checked_in_at: string
          communication_friction: boolean
          created_at: string
          energy_level: number
          helpful_strategy: string
          id: string
          time_of_day: string
          user_id: string
          workload_level: string
        }
        Insert: {
          break_status: string
          calendar_context?: Json
          checked_in_at?: string
          communication_friction?: boolean
          created_at?: string
          energy_level: number
          helpful_strategy: string
          id?: string
          time_of_day: string
          user_id: string
          workload_level: string
        }
        Update: {
          break_status?: string
          calendar_context?: Json
          checked_in_at?: string
          communication_friction?: boolean
          created_at?: string
          energy_level?: number
          helpful_strategy?: string
          id?: string
          time_of_day?: string
          user_id?: string
          workload_level?: string
        }
        Relationships: []
      }
      workday_day_plans: {
        Row: {
          created_at: string
          focus: string
          id: string
          next_step: string
          plan_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus: string
          id?: string
          next_step?: string
          plan_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus?: string
          id?: string
          next_step?: string
          plan_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workday_pattern_summaries: {
        Row: {
          acknowledged_at: string | null
          active: boolean
          category: string
          created_at: string
          evidence: Json
          generated_at: string
          id: string
          pattern_key: string
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          active?: boolean
          category: string
          created_at?: string
          evidence?: Json
          generated_at?: string
          id?: string
          pattern_key: string
          status?: string
          summary: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          active?: boolean
          category?: string
          created_at?: string
          evidence?: Json
          generated_at?: string
          id?: string
          pattern_key?: string
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      workday_reminders: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          id: string
          reminder_kind: string
          reminder_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          id?: string
          reminder_kind?: string
          reminder_time: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          id?: string
          reminder_kind?: string
          reminder_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workday_support_actions: {
        Row: {
          action_type: string
          checkin_id: string
          created_at: string
          followed_up_at: string | null
          id: string
          outcome: string | null
          remember_for_learning: boolean
          user_id: string
        }
        Insert: {
          action_type: string
          checkin_id: string
          created_at?: string
          followed_up_at?: string | null
          id?: string
          outcome?: string | null
          remember_for_learning?: boolean
          user_id: string
        }
        Update: {
          action_type?: string
          checkin_id?: string
          created_at?: string
          followed_up_at?: string | null
          id?: string
          outcome?: string | null
          remember_for_learning?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workday_support_actions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "workday_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      workday_support_plans: {
        Row: {
          active: boolean
          created_at: string
          cue: string
          id: string
          support_action: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cue: string
          id?: string
          support_action: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cue?: string
          id?: string
          support_action?: string
          title?: string
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
      commit_slack_credit: {
        Args: {
          p_event_type: string
          p_flow_type: string
          p_reservation_id: string
        }
        Returns: {
          allowance_limit: number
          beckett_user_id: string | null
          committed_at: string | null
          expires_at: string
          id: string
          released_at: string | null
          request_id: string
          reserved_at: string
          slack_team_id: string
          slack_user_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "slack_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_web_credit: {
        Args: { p_reservation_id: string }
        Returns: {
          action: string
          committed_at: string | null
          expires_at: string
          id: string
          metadata: Json
          released_at: string | null
          request_id: string
          reserved_at: string
          source: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "web_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_ai_usage: {
        Args: {
          p_action: string
          p_limit: number
          p_metadata: Json
          p_source: string
          p_token_estimate: number
          p_user_id: string
        }
        Returns: number
      }
      ensure_web_course_access: {
        Args: {
          p_course_id: string
          p_limit: number
          p_period_start: string
          p_user_id: string
        }
        Returns: boolean
      }
      hook_require_approved_beta_signup: {
        Args: { event: Json }
        Returns: Json
      }
      release_slack_credit: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      release_web_credit: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      reserve_slack_command_job: {
        Args: {
          p_intent: string
          p_request_key: string
          p_slack_team_id: string
          p_slack_user_id: string
          p_spacing_ms?: number
        }
        Returns: {
          is_duplicate: boolean
          job_id: string
          scheduled_at: string
        }[]
      }
      reserve_slack_credit: {
        Args: {
          p_allowance_limit: number
          p_beckett_user_id: string
          p_request_id: string
          p_slack_team_id: string
          p_slack_user_id: string
        }
        Returns: {
          allowance_limit: number
          beckett_user_id: string | null
          committed_at: string | null
          expires_at: string
          id: string
          released_at: string | null
          request_id: string
          reserved_at: string
          slack_team_id: string
          slack_user_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "slack_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_web_credit: {
        Args: {
          p_action: string
          p_daily_limit: number
          p_metadata: Json
          p_monthly_limit: number
          p_request_id: string
          p_source: string
          p_user_id: string
        }
        Returns: {
          action: string
          committed_at: string | null
          expires_at: string
          id: string
          metadata: Json
          released_at: string | null
          request_id: string
          reserved_at: string
          source: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "web_credit_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
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
