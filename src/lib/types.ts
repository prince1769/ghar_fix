export type Role = 'customer' | 'provider' | 'admin';

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  landmark: string | null;
  pincode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
  color: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Service = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_charge: number;
  min_charge: number;
  extra_charge_desc: string | null;
  est_duration_min: number;
  is_active: boolean;
  sort_order: number;
};

export type ProviderProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  category_ids: string[];
  skills: string[];
  experience_years: number;
  charges_visiting: number;
  charges_hourly: number;
  service_areas: string[];
  working_hours: Record<string, { start: string; end: string }>;
  upi_id: string | null;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejected_reason: string | null;
  is_available: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  total_earnings: number;
  created_at: string;
};

export type BookingStatus =
  | 'finding'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type Pricing = {
  base: number;
  additional: number;
  platform_fee: number;
  discount: number;
  total: number;
};

export type Booking = {
  id: string;
  customer_id: string;
  provider_id: string | null;
  category_id: string;
  service_id: string;
  address_id: string | null;
  scheduled_at: string | null;
  is_immediate: boolean;
  status: BookingStatus;
  problem_desc: string | null;
  photos: string[];
  coupon_code: string | null;
  pricing: Pricing;
  payment_method: 'cod' | 'upi' | 'online';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type StatusHistory = {
  id: string;
  booking_id: string;
  status: BookingStatus;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  is_report: boolean;
  report_note: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'flat' | 'percent';
  discount_value: number;
  min_order: number;
  max_discount: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  usage_count: number;
};

export type Notification = {
  id: string;
  user_id: string | null;
  role: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  user_id: string;
  role: string;
  booking_id: string | null;
  subject: string;
  message: string;
  status: 'open' | 'resolved' | 'closed';
  admin_reply: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  booking_id: string;
  method: 'cod' | 'upi' | 'online';
  base_charge: number;
  additional_charge: number;
  platform_fee: number;
  discount: number;
  commission: number;
  provider_payout: number;
  total: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
};

export type PlatformSettings = {
  id: number;
  commission_pct: number;
  platform_fee: number;
  cancellation_charge: number;
};
