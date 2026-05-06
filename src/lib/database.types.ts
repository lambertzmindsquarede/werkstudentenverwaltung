export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      arbeitsorte: {
        Row: {
          id: string
          manager_id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          manager_id?: string
          name?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      booking_change_log: {
        Row: {
          id: string
          entry_id: string | null
          user_id: string
          date: string
          field_changed: 'actual_start' | 'actual_end' | 'break_minutes'
          old_value: string | null
          new_value: string | null
          changed_at: string
          notified_at: string | null
        }
        Insert: {
          id?: string
          entry_id?: string | null
          user_id: string
          date: string
          field_changed: 'actual_start' | 'actual_end' | 'break_minutes'
          old_value?: string | null
          new_value?: string | null
          changed_at?: string
          notified_at?: string | null
        }
        Update: {
          id?: string
          entry_id?: string | null
          user_id?: string
          date?: string
          field_changed?: 'actual_start' | 'actual_end' | 'break_minutes'
          old_value?: string | null
          new_value?: string | null
          changed_at?: string
          notified_at?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      actual_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          actual_start: string | null
          actual_end: string | null
          is_complete: boolean
          block_index: number | null
          break_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          actual_start?: string | null
          actual_end?: string | null
          is_complete?: boolean
          block_index?: number | null
          break_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          actual_start?: string | null
          actual_end?: string | null
          is_complete?: boolean
          block_index?: number | null
          break_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      planned_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          planned_start: string
          planned_end: string
          block_index: number | null
          arbeitsort_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          planned_start: string
          planned_end: string
          block_index?: number | null
          arbeitsort_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          planned_start?: string
          planned_end?: string
          block_index?: number | null
          arbeitsort_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bereiche: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      bereich_manager: {
        Row: {
          bereich_id: string
          user_id: string
        }
        Insert: {
          bereich_id: string
          user_id: string
        }
        Update: {
          bereich_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bereich_manager_bereich_id_fkey'
            columns: ['bereich_id']
            isOneToOne: false
            referencedRelation: 'bereiche'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bereich_manager_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: 'werkstudent' | 'manager' | null
          weekly_hour_limit: number | null
          is_active: boolean | null
          bundesland: string
          manager_id: string | null
          is_admin: boolean
          bereich_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: 'werkstudent' | 'manager' | null
          weekly_hour_limit?: number | null
          is_active?: boolean | null
          bundesland?: string
          manager_id?: string | null
          is_admin?: boolean
          bereich_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: 'werkstudent' | 'manager' | null
          weekly_hour_limit?: number | null
          is_active?: boolean | null
          bundesland?: string
          manager_id?: string | null
          is_admin?: boolean
          bereich_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileWithManager = Profile & { manager?: Pick<Profile, 'id' | 'full_name'> | null }
export const DEFAULT_BUNDESLAND = 'NW'
export type UserRole = 'werkstudent' | 'manager'
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type ActualEntry = {
  id: string
  user_id: string
  date: string
  actual_start: string | null
  actual_end: string | null
  is_complete: boolean
  block_index: number | null
  break_minutes: number
  created_at: string
  updated_at: string
}

export const DEFAULT_MAX_EDIT_DAYS_PAST = 14

export type BookingChangeLog = Database['public']['Tables']['booking_change_log']['Row']

export type AppSetting = Database['public']['Tables']['app_settings']['Row']

export type PlannedEntry = {
  id: string
  user_id: string
  date: string
  planned_start: string
  planned_end: string
  block_index: number | null
  arbeitsort_id: string | null
  arbeitsort?: { id: string; name: string; is_active: boolean } | null
  created_at: string
  updated_at: string
}

export type Arbeitsort = {
  id: string
  manager_id: string
  name: string
  is_active: boolean
  created_at: string
}

export type Bereich = Database['public']['Tables']['bereiche']['Row']
export type BereichManager = Database['public']['Tables']['bereich_manager']['Row']

export type BereichWithCounts = Bereich & {
  managerCount: number
  werkstudentCount: number
}
