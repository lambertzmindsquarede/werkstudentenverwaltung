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
      actual_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          actual_start: string | null
          actual_end: string | null
          is_complete: boolean
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
          created_at?: string
          updated_at?: string
        }
      }
      planned_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          planned_start: string
          planned_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          planned_start: string
          planned_end: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          planned_start?: string
          planned_end?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: 'werkstudent' | 'manager' | null
          weekly_hour_limit: number | null
          is_active: boolean | null
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
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type UserRole = 'werkstudent' | 'manager'
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type ActualEntry = {
  id: string
  user_id: string
  date: string
  actual_start: string | null
  actual_end: string | null
  is_complete: boolean
  created_at: string
  updated_at: string
}

export type PlannedEntry = {
  id: string
  user_id: string
  date: string
  planned_start: string
  planned_end: string
  created_at: string
  updated_at: string
}
