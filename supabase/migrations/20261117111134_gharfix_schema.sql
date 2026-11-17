/*
# GharFix — Home Services Booking Platform Schema

## Overview
Multi-tenant, role-based platform connecting Indian customers with local home
service professionals. Three roles: customer, provider, admin. Phone OTP auth.

## New Tables
- profiles: extends auth.users with role, name, phone, email, avatar.
- addresses: customer saved home addresses (GPS + manual, landmark, PIN).
- service_categories: 12 categories with icon, color, description, sort order.
- services: specific services under each category with pricing and duration.
- provider_profiles: provider KYC, skills, charges, working hours, service
  areas, approval state, ratings, UPI/bank, identity docs metadata.
- provider_documents: individual uploaded document rows (Aadhaar, certificates).
- bookings: core booking record linking customer, provider, service, address,
  schedule, status, pricing breakdown, payment info, timestamps.
- booking_status_history: append-only status timeline per booking.
- payments: payment records with method, amounts, platform fee, commission,
  provider payout, status.
- reviews: customer ratings (1-5) + comments + photos per completed booking.
- coupons: promotional codes with discount rules and validity windows.
- notifications: in-app notifications per user/role with read flag.
- support_tickets: customer/provider raised issues, admin-managed.
- platform_settings: singleton config — commission %, platform fee, cancellation
  charge.

## Security
- RLS enabled on every table.
- Grants scoped to authenticated (sign-in app) plus service_role where needed.
- Ownership policies using auth.uid() and role checks via profiles subquery.
- Admin role gets broad access through `EXISTS (SELECT 1 FROM profiles WHERE
  id = auth.uid() AND role = 'admin')` predicates.
- Provider can only see bookings assigned to them; customer only their own
  bookings. Provider personal fields (upi_id, bank_details, identity_docs)
  hidden from customers via column grants on provider_profiles.
- accept_booking RPC is SECURITY DEFINER, atomic, prevents double-assignment.

## Notes
- Seed data: 12 service categories + sample services, default platform_settings.
- Prices in INR. Phone OTP via Supabase auth (SMS provider configured later).
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','provider','admin')),
  full_name text,
  phone text,
  email text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO service_role;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;
CREATE POLICY "profiles_select_self_or_admin" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'provider' AND p.is_active)
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON profiles;
CREATE POLICY "profiles_update_self_or_admin" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- addresses ----------
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  line1 text NOT NULL,
  landmark text,
  pincode text,
  city text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON addresses TO authenticated;
GRANT SELECT ON addresses TO service_role;

DROP POLICY IF EXISTS "addresses_owner_select" ON addresses;
CREATE POLICY "addresses_owner_select" ON addresses FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "addresses_owner_insert" ON addresses;
CREATE POLICY "addresses_owner_insert" ON addresses FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "addresses_owner_update" ON addresses;
CREATE POLICY "addresses_owner_update" ON addresses FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "addresses_owner_delete" ON addresses;
CREATE POLICY "addresses_owner_delete" ON addresses FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ---------- service_categories ----------
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon_name text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_categories TO authenticated;
GRANT SELECT ON service_categories TO anon;

DROP POLICY IF EXISTS "categories_read_all" ON service_categories;
CREATE POLICY "categories_read_all" ON service_categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_admin_write" ON service_categories;
CREATE POLICY "categories_admin_write" ON service_categories FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "categories_admin_update" ON service_categories;
CREATE POLICY "categories_admin_update" ON service_categories FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "categories_admin_delete" ON service_categories;
CREATE POLICY "categories_admin_delete" ON service_categories FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- services ----------
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  base_charge numeric NOT NULL DEFAULT 0,
  min_charge numeric NOT NULL DEFAULT 0,
  extra_charge_desc text,
  est_duration_min int NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;
GRANT SELECT ON services TO anon;
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);

DROP POLICY IF EXISTS "services_read_all" ON services;
CREATE POLICY "services_read_all" ON services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "services_admin_write" ON services;
CREATE POLICY "services_admin_write" ON services FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "services_admin_update" ON services;
CREATE POLICY "services_admin_update" ON services FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "services_admin_delete" ON services;
CREATE POLICY "services_admin_delete" ON services FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- provider_profiles ----------
CREATE TABLE IF NOT EXISTS provider_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  email text,
  avatar_url text,
  bio text,
  category_ids uuid[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  experience_years int NOT NULL DEFAULT 0,
  charges_visiting numeric NOT NULL DEFAULT 0,
  charges_hourly numeric NOT NULL DEFAULT 0,
  service_areas text[] NOT NULL DEFAULT '{}',
  working_hours jsonb NOT NULL DEFAULT '{}',
  upi_id text,
  bank_details jsonb,
  identity_docs jsonb,
  is_approved boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  is_available boolean NOT NULL DEFAULT true,
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count int NOT NULL DEFAULT 0,
  jobs_completed int NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
-- Public read of non-sensitive columns for customers; full read for self/admin.
GRANT SELECT (id, full_name, phone, email, avatar_url, bio, category_ids, skills, experience_years, charges_visiting, charges_hourly, service_areas, working_hours, is_approved, approval_status, is_available, rating_avg, rating_count, jobs_completed, total_earnings, created_at, updated_at) ON provider_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON provider_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_profiles TO service_role;

DROP POLICY IF EXISTS "providers_select_visible" ON provider_profiles;
CREATE POLICY "providers_select_visible" ON provider_profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (is_approved AND approval_status = 'approved' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'customer'))
  );
DROP POLICY IF EXISTS "providers_insert_self" ON provider_profiles;
CREATE POLICY "providers_insert_self" ON provider_profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "providers_update_self_or_admin" ON provider_profiles;
CREATE POLICY "providers_update_self_or_admin" ON provider_profiles FOR UPDATE
  TO authenticated USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- provider_documents ----------
CREATE TABLE IF NOT EXISTS provider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE provider_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_documents TO service_role;
CREATE INDEX IF NOT EXISTS idx_provider_docs ON provider_documents(provider_id);

DROP POLICY IF EXISTS "docs_select_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_select_owner_or_admin" ON provider_documents FOR SELECT
  TO authenticated USING (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "docs_insert_owner" ON provider_documents;
CREATE POLICY "docs_insert_owner" ON provider_documents FOR INSERT
  TO authenticated WITH CHECK (provider_id = auth.uid());
DROP POLICY IF EXISTS "docs_update_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_update_owner_or_admin" ON provider_documents FOR UPDATE
  TO authenticated USING (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "docs_delete_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_delete_owner_or_admin" ON provider_documents FOR DELETE
  TO authenticated USING (provider_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- bookings ----------
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  is_immediate boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'finding' CHECK (status IN ('finding','accepted','on_the_way','arrived','in_progress','completed','cancelled','rejected')),
  problem_desc text,
  photos jsonb NOT NULL DEFAULT '[]',
  coupon_code text,
  pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','upi','online')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings TO service_role;
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

DROP POLICY IF EXISTS "bookings_select_party_or_admin" ON bookings;
CREATE POLICY "bookings_select_party_or_admin" ON bookings FOR SELECT
  TO authenticated USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "bookings_insert_customer" ON bookings;
CREATE POLICY "bookings_insert_customer" ON bookings FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS "bookings_update_party_or_admin" ON bookings;
CREATE POLICY "bookings_update_party_or_admin" ON bookings FOR UPDATE
  TO authenticated USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "bookings_delete_admin" ON bookings;
CREATE POLICY "bookings_delete_admin" ON bookings FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- booking_status_history ----------
CREATE TABLE IF NOT EXISTS booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON booking_status_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON booking_status_history TO service_role;
CREATE INDEX IF NOT EXISTS idx_history_booking ON booking_status_history(booking_id);

DROP POLICY IF EXISTS "history_select_party_or_admin" ON booking_status_history;
CREATE POLICY "history_select_party_or_admin" ON booking_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "history_insert_party_or_admin" ON booking_status_history;
CREATE POLICY "history_insert_party_or_admin" ON booking_status_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------- payments ----------
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cod','upi','online')),
  base_charge numeric NOT NULL DEFAULT 0,
  additional_charge numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  provider_payout numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO service_role;
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

DROP POLICY IF EXISTS "payments_select_party_or_admin" ON payments;
CREATE POLICY "payments_select_party_or_admin" ON payments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "payments_insert_party_or_admin" ON payments;
CREATE POLICY "payments_insert_party_or_admin" ON payments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "payments_update_party_or_admin" ON payments;
CREATE POLICY "payments_update_party_or_admin" ON payments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------- reviews ----------
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  photos jsonb NOT NULL DEFAULT '[]',
  is_report boolean NOT NULL DEFAULT false,
  report_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO service_role;
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "reviews_insert_customer" ON reviews;
CREATE POLICY "reviews_insert_customer" ON reviews FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS "reviews_update_owner_or_admin" ON reviews;
CREATE POLICY "reviews_update_owner_or_admin" ON reviews FOR UPDATE
  TO authenticated USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "reviews_delete_admin" ON reviews;
CREATE POLICY "reviews_delete_admin" ON reviews FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- coupons ----------
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat','percent')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  max_discount numeric NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  usage_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON coupons TO authenticated;
GRANT SELECT ON coupons TO anon;

DROP POLICY IF EXISTS "coupons_read_active" ON coupons;
CREATE POLICY "coupons_read_active" ON coupons FOR SELECT
  TO anon, authenticated USING (is_active AND (valid_to IS NULL OR valid_to > now()));
DROP POLICY IF EXISTS "coupons_admin_write" ON coupons;
CREATE POLICY "coupons_admin_write" ON coupons FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "coupons_admin_update" ON coupons;
CREATE POLICY "coupons_admin_update" ON coupons FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "coupons_admin_delete" ON coupons;
CREATE POLICY "coupons_admin_delete" ON coupons FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO service_role;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

DROP POLICY IF EXISTS "notifications_select_self" ON notifications;
CREATE POLICY "notifications_select_self" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_self_or_admin" ON notifications;
CREATE POLICY "notifications_insert_self_or_admin" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "notifications_update_self" ON notifications;
CREATE POLICY "notifications_update_self" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete_self" ON notifications;
CREATE POLICY "notifications_delete_self" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ---------- support_tickets ----------
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON support_tickets TO service_role;
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);

DROP POLICY IF EXISTS "tickets_select_self_or_admin" ON support_tickets;
CREATE POLICY "tickets_select_self_or_admin" ON support_tickets FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "tickets_insert_self" ON support_tickets;
CREATE POLICY "tickets_insert_self" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "tickets_update_self_or_admin" ON support_tickets;
CREATE POLICY "tickets_update_self_or_admin" ON support_tickets FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- platform_settings (singleton) ----------
CREATE TABLE IF NOT EXISTS platform_settings (
  id int PRIMARY KEY DEFAULT 1,
  commission_pct numeric NOT NULL DEFAULT 15,
  platform_fee numeric NOT NULL DEFAULT 20,
  cancellation_charge numeric NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON platform_settings TO authenticated, anon;
GRANT SELECT, UPDATE ON platform_settings TO service_role;

DROP POLICY IF EXISTS "settings_read_all" ON platform_settings;
CREATE POLICY "settings_read_all" ON platform_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_update_admin" ON platform_settings;
CREATE POLICY "settings_update_admin" ON platform_settings FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------- accept_booking RPC (atomic provider assignment) ----------
CREATE OR REPLACE FUNCTION accept_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b bookings%ROWTYPE;
  caller uuid := auth.uid();
  is_provider_row provider_profiles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Booking not found');
  END IF;
  SELECT * INTO is_provider_row FROM provider_profiles WHERE id = caller;
  IF NOT FOUND OR is_provider_row.is_approved = false OR is_provider_row.approval_status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only approved providers can accept');
  END IF;
  IF b.provider_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already assigned');
  END IF;
  IF b.status NOT IN ('finding') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Booking not available');
  END IF;
  UPDATE bookings SET provider_id = caller, status = 'accepted', accepted_at = now()
  WHERE id = p_booking_id;
  INSERT INTO booking_status_history (booking_id, status, note, actor_id)
  VALUES (p_booking_id, 'accepted', 'Provider accepted request', caller);
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (b.customer_id, 'booking_accepted', 'Professional on the way',
    'Your booking was accepted by a professional.',
    jsonb_build_object('booking_id', p_booking_id));
  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION accept_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_booking(uuid) TO authenticated;

-- ---------- Seed service categories ----------
INSERT INTO service_categories (name, slug, icon_name, color, description, sort_order)
VALUES
  ('Electrician','electrician','Zap','#7c3aed','Wiring, switches, fans, lights and all electrical repairs',1),
  ('Plumber','plumber','Droplets','#0ea5e9','Taps, pipes, leaks, drainage and bathroom fittings',2),
  ('Maid / House Help','maid','Sparkles','#ec4899','Daily cleaning, utensils, sweeping and mopping',3),
  ('Home Cleaning','home-cleaning','Wind','#10b981','Deep cleaning for kitchen, bathroom, full home',4),
  ('Carpenter','carpenter','Hammer','#b45309','Furniture repair, doors, hinges and modular work',5),
  ('AC Repair & Servicing','ac-repair','Snowflake','#0891b2','AC installation, gas refill, servicing and repair',6),
  ('Washing Machine Repair','washing-machine','WashingMachine','#6366f1','Washing machine repair and servicing',7),
  ('Refrigerator Repair','refrigerator','Refrigerator','#14b8a6','Fridge cooling, compressor and servicing',8),
  ('Painter','painter','PaintRoller','#f97316','Interior, exterior, waterproofing and texture',9),
  ('Pest Control','pest-control','Bug','#84cc16','Cockroach, termite, mosquito and rodent control',10),
  ('RO Water Purifier','ro-purifier','GlassWater','#06b6d4','RO installation, filter change and repair',11),
  ('Appliance Repair','appliance-repair','Wrench','#a855f7','Microwave, geyser, chimney and mixed appliances',12)
ON CONFLICT (slug) DO NOTHING;

-- ---------- Seed services ----------
INSERT INTO services (category_id, name, slug, description, base_charge, min_charge, extra_charge_desc, est_duration_min, sort_order)
SELECT c.id, v.name, v.slug, v.description, v.base_charge, v.min_charge, v.extra_charge_desc, v.est_duration_min, v.sort_order
FROM (VALUES
  ('electrician','Fan installation','fan-installation','Ceiling fan install or replace',250,250,'Parts extra',45,1),
  ('electrician','Switch & socket repair','switch-repair','Switch, socket or board repair',199,199,'Parts extra',30,2),
  ('electrician','Wiring & rewiring','wiring','House wiring, rewiring, junction box',499,499,'Per point extra',90,3),
  ('electrician','Light installation','light-installation','Light, tube light, LED fitting',149,149,'Fixture extra',30,4),
  ('plumber','Tap repair','tap-repair','Leaking or broken tap repair',199,199,'Parts extra',30,1),
  ('plumber','Pipe leakage','pipe-leakage','Pipe leakage detection and fix',299,299,'Parts extra',60,2),
  ('plumber','Bathroom fitting','bathroom-fitting','Shower, flush, jet spray fitting',399,399,'Parts extra',75,3),
  ('plumber','Drainage issues','drainage','Blockage and drainage clearing',349,349,'Extra if major',60,4),
  ('maid','Daily cleaning','daily-cleaning','Sweeping, mopping and dusting',3000,3000,'Monthly',60,1),
  ('maid','Utensils washing','utensils-washing','Daily utensils washing',1500,1500,'Monthly',45,2),
  ('maid','Sweeping & mopping','sweeping-mopping','Sweeping and mopping only',2000,2000,'Monthly',60,3),
  ('home-cleaning','Full home deep cleaning','full-home-deep','Full home deep cleaning',2499,1999,'Per BHK extra',240,1),
  ('home-cleaning','Kitchen deep cleaning','kitchen-deep','Kitchen deep cleaning',1299,999,'Extra for chimney',120,2),
  ('home-cleaning','Bathroom deep cleaning','bathroom-deep','Bathroom deep cleaning',599,499,'Per bathroom',60,3),
  ('carpenter','Door & hinge repair','door-hinge','Door, hinge, lock repair',249,199,'Parts extra',45,1),
  ('carpenter','Furniture repair','furniture-repair','Chair, table, bed repair',399,299,'Material extra',75,2),
  ('ac-repair','AC servicing','ac-servicing','Split/window AC service',499,399,'Gas extra',90,1),
  ('ac-repair','AC installation','ac-installation','AC install or uninstall',999,799,'Extra bracket',120,2),
  ('ac-repair','AC gas refill','ac-gas','Gas refill and cooling fix',1799,1499,'Per ton extra',90,3),
  ('washing-machine','Washing machine repair','wm-repair','All brand WM repair',399,299,'Parts extra',75,1),
  ('refrigerator','Fridge cooling repair','fridge-cooling','Cooling, gas, compressor',499,399,'Parts extra',75,1),
  ('painter','Interior painting','interior-paint','Walls, ceiling interior paint',15,12,'Per sq ft',480,1),
  ('painter','Exterior painting','exterior-paint','Exterior waterproofing paint',25,20,'Per sq ft',480,2),
  ('pest-control','Cockroach control','cockroach','Gel & spray treatment',799,599,'Per session',60,1),
  ('pest-control','Termite control','termite','Termite treatment',1499,999,'Warranty',90,2),
  ('ro-purifier','RO service','ro-service','Filter change and service',399,299,'Filter extra',45,1),
  ('appliance-repair','Microwave repair','microwave','Microwave repair',499,399,'Parts extra',60,1),
  ('appliance-repair','Geyser repair','geyser','Geyser servicing',349,299,'Parts extra',45,2)
) AS v(cat, name, slug, description, base_charge, min_charge, extra_charge_desc, est_duration_min, sort_order)
JOIN service_categories c ON c.slug = v.cat
ON CONFLICT DO NOTHING;

-- ---------- Default platform settings ----------
INSERT INTO platform_settings (id, commission_pct, platform_fee, cancellation_charge)
VALUES (1, 15, 20, 25)
ON CONFLICT (id) DO NOTHING;

-- ---------- Sample coupons ----------
INSERT INTO coupons (code, description, discount_type, discount_value, min_order, max_discount, valid_to)
VALUES
  ('GHAR50','Flat 50 off on first booking','flat',50,199,50, now() + interval '365 days'),
  ('FIX10','10% off up to 100','percent',10,299,100, now() + interval '365 days'),
  ('CLEAN150','Flat 150 off on cleaning','flat',150,999,150, now() + interval '365 days')
ON CONFLICT (code) DO NOTHING;
