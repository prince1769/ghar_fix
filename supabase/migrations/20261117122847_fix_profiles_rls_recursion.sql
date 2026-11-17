/*
# Fix infinite RLS recursion on profiles

## Problem
The profiles table policies referenced `profiles` itself (e.g.
`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`).
Querying profiles evaluates the policy, which queries profiles, which evaluates
the policy again → infinite recursion error.

## Fix
1. Create SECURITY DEFINER helper functions that read role/approval from
   profiles WITHOUT RLS (function runs as owner, bypasses RLS):
   - `current_role_is_admin()` returns boolean
   - `current_role_is(role text)` returns boolean
   - `provider_is_approved(uid uuid)` returns boolean
2. Rewrite ALL policies across all tables that previously did
   `EXISTS (SELECT 1 FROM profiles ...)` to call these helpers instead.
3. This breaks the recursive chain because the functions do not go through RLS.

## Security
- Helper functions are SECURITY DEFINER, owned by postgres, run with owner
  privileges (bypass RLS). They only READ — no writes. They are safe to expose
  to authenticated users for authorization checks.
- REVOKE EXECUTE from PUBLIC/anon, GRANT to authenticated only.
*/

-- ---------- Helper functions (SECURITY DEFINER, bypass RLS) ----------
CREATE OR REPLACE FUNCTION current_role_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION current_role_is(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = p_role);
$$;

CREATE OR REPLACE FUNCTION provider_is_approved(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM provider_profiles WHERE id = p_uid AND is_approved AND approval_status = 'approved');
$$;

REVOKE EXECUTE ON FUNCTION current_role_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_role_is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_role_is(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_role_is(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION provider_is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION provider_is_approved(uuid) TO authenticated;

-- ---------- Rewrite profiles policies ----------
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;
CREATE POLICY "profiles_select_self_or_admin" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR current_role_is_admin()
    OR current_role_is('provider')
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON profiles;
CREATE POLICY "profiles_update_self_or_admin" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid() OR current_role_is_admin())
  WITH CHECK (id = auth.uid() OR current_role_is_admin());

-- ---------- Rewrite service_categories admin policies ----------
DROP POLICY IF EXISTS "categories_admin_write" ON service_categories;
CREATE POLICY "categories_admin_write" ON service_categories FOR INSERT
  TO authenticated WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "categories_admin_update" ON service_categories;
CREATE POLICY "categories_admin_update" ON service_categories FOR UPDATE
  TO authenticated USING (current_role_is_admin())
  WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "categories_admin_delete" ON service_categories;
CREATE POLICY "categories_admin_delete" ON service_categories FOR DELETE
  TO authenticated USING (current_role_is_admin());

-- ---------- Rewrite services admin policies ----------
DROP POLICY IF EXISTS "services_admin_write" ON services;
CREATE POLICY "services_admin_write" ON services FOR INSERT
  TO authenticated WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "services_admin_update" ON services;
CREATE POLICY "services_admin_update" ON services FOR UPDATE
  TO authenticated USING (current_role_is_admin())
  WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "services_admin_delete" ON services;
CREATE POLICY "services_admin_delete" ON services FOR DELETE
  TO authenticated USING (current_role_is_admin());

-- ---------- Rewrite provider_profiles policies ----------
DROP POLICY IF EXISTS "providers_select_visible" ON provider_profiles;
CREATE POLICY "providers_select_visible" ON provider_profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR current_role_is_admin()
    OR (is_approved AND approval_status = 'approved' AND current_role_is('customer'))
  );

DROP POLICY IF EXISTS "providers_update_self_or_admin" ON provider_profiles;
CREATE POLICY "providers_update_self_or_admin" ON provider_profiles FOR UPDATE
  TO authenticated USING (id = auth.uid() OR current_role_is_admin())
  WITH CHECK (id = auth.uid() OR current_role_is_admin());

-- ---------- Rewrite provider_documents policies ----------
DROP POLICY IF EXISTS "docs_select_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_select_owner_or_admin" ON provider_documents FOR SELECT
  TO authenticated USING (provider_id = auth.uid() OR current_role_is_admin());

DROP POLICY IF EXISTS "docs_update_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_update_owner_or_admin" ON provider_documents FOR UPDATE
  TO authenticated USING (provider_id = auth.uid() OR current_role_is_admin())
  WITH CHECK (provider_id = auth.uid() OR current_role_is_admin());

DROP POLICY IF EXISTS "docs_delete_owner_or_admin" ON provider_documents;
CREATE POLICY "docs_delete_owner_or_admin" ON provider_documents FOR DELETE
  TO authenticated USING (provider_id = auth.uid() OR current_role_is_admin());

-- ---------- Rewrite bookings policies ----------
DROP POLICY IF EXISTS "bookings_select_party_or_admin" ON bookings;
CREATE POLICY "bookings_select_party_or_admin" ON bookings FOR SELECT
  TO authenticated USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR current_role_is_admin()
  );

DROP POLICY IF EXISTS "bookings_update_party_or_admin" ON bookings;
CREATE POLICY "bookings_update_party_or_admin" ON bookings FOR UPDATE
  TO authenticated USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR current_role_is_admin()
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR current_role_is_admin()
  );

DROP POLICY IF EXISTS "bookings_delete_admin" ON bookings;
CREATE POLICY "bookings_delete_admin" ON bookings FOR DELETE
  TO authenticated USING (current_role_is_admin());

-- ---------- Rewrite booking_status_history policies ----------
DROP POLICY IF EXISTS "history_select_party_or_admin" ON booking_status_history;
CREATE POLICY "history_select_party_or_admin" ON booking_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  );

DROP POLICY IF EXISTS "history_insert_party_or_admin" ON booking_status_history;
CREATE POLICY "history_insert_party_or_admin" ON booking_status_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  );

-- ---------- Rewrite payments policies ----------
DROP POLICY IF EXISTS "payments_select_party_or_admin" ON payments;
CREATE POLICY "payments_select_party_or_admin" ON payments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  );

DROP POLICY IF EXISTS "payments_insert_party_or_admin" ON payments;
CREATE POLICY "payments_insert_party_or_admin" ON payments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  );

DROP POLICY IF EXISTS "payments_update_party_or_admin" ON payments;
CREATE POLICY "payments_update_party_or_admin" ON payments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()))
    OR current_role_is_admin()
  );

-- ---------- Rewrite reviews policies ----------
DROP POLICY IF EXISTS "reviews_update_owner_or_admin" ON reviews;
CREATE POLICY "reviews_update_owner_or_admin" ON reviews FOR UPDATE
  TO authenticated USING (customer_id = auth.uid() OR current_role_is_admin())
  WITH CHECK (customer_id = auth.uid() OR current_role_is_admin());

DROP POLICY IF EXISTS "reviews_delete_admin" ON reviews;
CREATE POLICY "reviews_delete_admin" ON reviews FOR DELETE
  TO authenticated USING (current_role_is_admin());

-- ---------- Rewrite coupons admin policies ----------
DROP POLICY IF EXISTS "coupons_admin_write" ON coupons;
CREATE POLICY "coupons_admin_write" ON coupons FOR INSERT
  TO authenticated WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "coupons_admin_update" ON coupons;
CREATE POLICY "coupons_admin_update" ON coupons FOR UPDATE
  TO authenticated USING (current_role_is_admin())
  WITH CHECK (current_role_is_admin());

DROP POLICY IF EXISTS "coupons_admin_delete" ON coupons;
CREATE POLICY "coupons_admin_delete" ON coupons FOR DELETE
  TO authenticated USING (current_role_is_admin());

-- ---------- Rewrite notifications policies ----------
DROP POLICY IF EXISTS "notifications_insert_self_or_admin" ON notifications;
CREATE POLICY "notifications_insert_self_or_admin" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR current_role_is_admin());

-- ---------- Rewrite support_tickets policies ----------
DROP POLICY IF EXISTS "tickets_select_self_or_admin" ON support_tickets;
CREATE POLICY "tickets_select_self_or_admin" ON support_tickets FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR current_role_is_admin());

DROP POLICY IF EXISTS "tickets_update_self_or_admin" ON support_tickets;
CREATE POLICY "tickets_update_self_or_admin" ON support_tickets FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR current_role_is_admin())
  WITH CHECK (user_id = auth.uid() OR current_role_is_admin());

-- ---------- Rewrite platform_settings admin policy ----------
DROP POLICY IF EXISTS "settings_update_admin" ON platform_settings;
CREATE POLICY "settings_update_admin" ON platform_settings FOR UPDATE
  TO authenticated USING (current_role_is_admin())
  WITH CHECK (current_role_is_admin());
