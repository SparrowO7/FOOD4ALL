// Food4All — shared types mirroring Postgres enums & tables
export type UserRole = 'donor' | 'ngo' | 'volunteer' | 'admin';
export type DonorKind = 'individual' | 'restaurant' | 'hotel' | 'banquet' | 'other';
export type FoodType = 'veg' | 'nonveg' | 'vegan' | 'jain';
export type StorageCondition = 'room' | 'refrigerated' | 'hot_held';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type DonationStatus =
  | 'draft'
  | 'available'
  | 'claimed'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  city: string | null;
  donor_kind: DonorKind | null;
  donor_org_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ngo {
  id: string;
  org_name: string;
  registration_no: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacity_notes: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface Volunteer {
  id: string;
  vehicle_type: string;
  service_radius_km: number;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  is_available: boolean;
  total_pickups: number;
  created_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  title: string;
  description: string | null;
  food_type: FoodType;
  is_cooked: boolean;
  allergens: string | null;
  quantity_desc: string;
  servings_estimate: number | null;
  prepared_at: string | null;
  best_before: string;
  storage_condition: StorageCondition;
  photo_url: string | null;
  pickup_address: string;
  pickup_landmark: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_window_start: string;
  pickup_window_end: string;
  status: DonationStatus;
  claimed_by_ngo: string | null;
  assigned_volunteer: string | null;
  created_at: string;
  updated_at: string;
  // view extras
  address_revealed?: boolean;
}

export interface DonationEvent {
  id: string;
  donation_id: string;
  from_status: DonationStatus | null;
  to_status: DonationStatus;
  actor_id: string | null;
  actor_role: UserRole | null;
  note: string | null;
  created_at: string;
}

export interface ImpactSummary {
  donations_completed: number;
  meals_served: number;
  active_volunteers: number;
  partner_ngos: number;
  missed_expired: number;
}

export const FOOD_TYPE_LABEL: Record<FoodType, string> = {
  veg: 'Veg',
  nonveg: 'Non-Veg',
  vegan: 'Vegan',
  jain: 'Jain',
};

export const STATUS_LABEL: Record<DonationStatus, string> = {
  draft: 'Draft',
  available: 'Available',
  claimed: 'Claimed',
  pickup_scheduled: 'Pickup Scheduled',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const STATUS_COLOR: Record<DonationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  available: 'bg-emerald-100 text-emerald-800',
  claimed: 'bg-blue-100 text-blue-800',
  pickup_scheduled: 'bg-amber-100 text-amber-800',
  picked_up: 'bg-orange-100 text-orange-800',
  delivered: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-stone-100 text-stone-600',
};
