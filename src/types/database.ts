export type AttendanceResult =
  | { outcome: "recorded" | "already_recorded"; full_name: string; attended_at: string }
  | { outcome: "invalid"; full_name: null; attended_at: null };

export type Participant = {
  id: string;
  code: string;
  full_name: string;
  token: string;
  paid_amount: number;
  attendance_state: "PENDIENTE" | "ASISTIÓ";
  attended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantInput = { full_name: string; paid_amount?: number };
export type ParticipantListRow = Pick<Participant,
  "id" | "code" | "full_name" | "paid_amount" | "attendance_state" | "attended_at"
>;
export type DashboardMetrics = {
  registered: string;
  attended: string;
  pending: string;
  paid_total: string;
  attendance_percentage: string;
};

// Matches the migration's client-writable columns, not privileged database fields.
export type Database = {
  public: {
    Tables: {
      participants: {
        Row: Participant;
        Insert: ParticipantInput;
        Update: Partial<ParticipantInput>;
        Relationships: [];
      };
      approved_administrators: {
        Row: { user_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_dashboard_metrics: { Args: Record<string, never>; Returns: DashboardMetrics[] };
      record_attendance: {
        Args: { attendance_token: string };
        Returns: { outcome: string; full_name: string | null; attended_at: string | null }[];
      };
      next_participant_code: { Args: Record<string, never>; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
