// Published fields only; not the legacy identity/account payload.
export interface User {
  id: string;
  full_name: string;
  graduation_year: number;
  location: string;
  bio: string;
  current_company: string;
  current_role: string;
  position_is_current: boolean;
  linkedin_url: string;
  contact_email: string;
  updated_at: string;
  open_to_coffee_chats: boolean;
  open_to_mentorship: boolean;
  available_for_referrals: boolean;
  open_to_resume_review: boolean;
}
export interface AlumniFilters {
  search?: string;
  company?: string;
  location?: string;
  graduation_year?: number;
  open_to_coffee_chats?: boolean;
  open_to_mentorship?: boolean;
  available_for_referrals?: boolean;
  open_to_resume_review?: boolean;
}
