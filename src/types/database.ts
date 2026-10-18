// Food4All India — shared types mirroring Postgres enums & tables
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
  | 'expired'
  // Terminal. Food refused by the receiving side, which the Surplus Food
  // Regulations 2019 expressly contemplate (Schedule-I 2(4), "Food for
  // Disposal"). Added in 0010a_rejected_enum.sql — before that, an NGO
  // refusing food at the door had no honest status to record.
  | 'rejected';

/** Mirrors the failure_reason enum in 0010b_rejected_transitions.sql. */
export const FAILURE_REASONS = [
  'no_volunteer',
  'ngo_capacity_full',
  'donor_cancelled',
  'pickup_too_far',
  'insufficient_time',
  'food_unsafe',
  'food_below_minimum',
  'donor_unreachable',
  'ngo_unreachable',
  'outside_operating_hours',
  'other',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  no_volunteer: 'No volunteer available',
  ngo_capacity_full: 'NGO capacity full',
  donor_cancelled: 'Donor cancelled',
  pickup_too_far: 'Pickup too far',
  insufficient_time: 'Not enough time before best-before',
  food_unsafe: 'Food unsafe on inspection',
  food_below_minimum: 'Below minimum quantity',
  donor_unreachable: 'Donor unreachable',
  ngo_unreachable: 'NGO unreachable',
  outside_operating_hours: 'Outside operating hours',
  other: 'Other (explain)',
};

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
  // ---- FSSAI surplus-food record, added in 0009_compliance.sql ----
  batch_no: string | null;              // Schedule-II(5)
  food_temp_c: number | null;           // Schedule-II(9) — nullable by design
  is_perishable: boolean;               // Schedule-I 1(1)
  vegetarian_confirmed?: boolean;
  not_previously_served: boolean;       // reg 2(1)(d) attestation
  // ---- post-hoc failure annotation, added in 0011_outcomes.sql ----
  outcome_reason: FailureReason | null;
  outcome_note: string | null;
  outcome_set_by: string | null;
  outcome_set_at: string | null;
  // view extras
  address_revealed?: boolean;
}

/** One row per donation from the donation_outcomes view (0011_outcomes.sql). */
export interface DonationOutcome {
  id: string;
  status: DonationStatus;
  created_at: string;
  reason: FailureReason | null;
  reason_note: string | null;
  /** Whether the reason was given at the transition or annotated afterwards. */
  reason_source: 'transition' | 'annotated' | null;
  outcome_at: string | null;
  ended_by: string | null;
}

export interface DonationEvent {
  id: string;
  donation_id: string;
  from_status: DonationStatus | null;
  to_status: DonationStatus;
  actor_id: string | null;
  actor_role: UserRole | null;
  note: string | null;
  /** Set when a human ended the donation. NULL for forward transitions and for
   *  the system expiry sweeper, which cannot know why nobody collected. */
  reason: FailureReason | null;
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
  rejected: 'Rejected',
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
  // Distinct from cancelled: food was refused on safety grounds, which is a
  // different fact and must not be read as a donor changing their mind.
  rejected: 'bg-rose-200 text-rose-900',
};
