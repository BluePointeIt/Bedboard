-- =====================================================
-- RBAC Migration: Role-Based Access Control with Multi-Facility Support
-- =====================================================
-- This migration implements:
-- 1. Companies table with 3-letter facility codes
-- 2. User-Facilities junction table for regional users
-- 3. Updates to users table for facility assignment
-- 4. Facility_id columns on wings and residents
-- 5. Private schema with RLS helper functions
-- 6. RLS policies for all tables based on role hierarchy
-- =====================================================

-- =====================================================
-- PHASE 1: Create Companies Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    facility_code CHAR(3) NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_facility_code ON public.companies(facility_code);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION update_companies_updated_at();

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PHASE 2: Create User-Facilities Junction Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, facility_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_facilities_user_id ON public.user_facilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_facilities_facility_id ON public.user_facilities(facility_id);

-- Enable RLS
ALTER TABLE public.user_facilities ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PHASE 3: Update Users Table
-- =====================================================

-- Add new columns to users table
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS primary_facility_id UUID REFERENCES public.companies(id),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for facility lookup
CREATE INDEX IF NOT EXISTS idx_users_primary_facility_id ON public.users(primary_facility_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- =====================================================
-- PHASE 4: Add Facility to Data Tables
-- =====================================================

-- Add facility_id to wings table
ALTER TABLE public.wings
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_wings_facility_id ON public.wings(facility_id);

-- Add facility_id to residents table (denormalized for query performance)
ALTER TABLE public.residents
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_residents_facility_id ON public.residents(facility_id);

-- =====================================================
-- PHASE 5: Create Default Company and Migrate Data
-- =====================================================

-- Create default company for existing data
INSERT INTO public.companies (id, name, facility_code, address, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Default Facility',
    'DFL',
    'Default Address',
    true
)
ON CONFLICT (facility_code) DO NOTHING;

-- Assign all existing wings to default company
UPDATE public.wings
SET facility_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE facility_id IS NULL;

-- Assign all existing residents to default company
UPDATE public.residents
SET facility_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE facility_id IS NULL;

-- Assign all existing users to default company
UPDATE public.users
SET primary_facility_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE primary_facility_id IS NULL;

-- =====================================================
-- PHASE 6: Migrate User Roles
-- =====================================================

-- First, update the role column to allow new values temporarily
-- We need to handle this carefully to preserve data

-- Create a temporary column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_new TEXT;

-- Migrate roles: admin -> superuser, everything else -> user
UPDATE public.users
SET role_new = CASE
    WHEN role = 'admin' THEN 'superuser'
    ELSE 'user'
END
WHERE role_new IS NULL;

-- Drop old constraint if exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Update the role column
UPDATE public.users SET role = role_new WHERE role_new IS NOT NULL;

-- Drop temporary column
ALTER TABLE public.users DROP COLUMN IF EXISTS role_new;

-- Add new constraint for role
ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'supervisor', 'regional', 'superuser'));

-- =====================================================
-- PHASE 7: Create Private Schema and Helper Functions
-- =====================================================

-- Create private schema for security functions
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA private TO authenticated;

-- Function to get current user's ID
CREATE OR REPLACE FUNCTION private.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT auth.uid();
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Function to get current user's primary facility ID
CREATE OR REPLACE FUNCTION private.get_user_primary_facility()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT primary_facility_id FROM public.users WHERE id = auth.uid();
$$;

-- Function to get current user's accessible facility IDs
CREATE OR REPLACE FUNCTION private.get_user_accessible_facilities()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        -- Superusers can access all facilities
        WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'superuser' THEN
            (SELECT ARRAY_AGG(id) FROM public.companies WHERE is_active = true)
        -- Regional users can access assigned facilities
        WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'regional' THEN
            (SELECT ARRAY_AGG(DISTINCT facility_id) FROM (
                SELECT facility_id FROM public.user_facilities WHERE user_id = auth.uid()
                UNION
                SELECT primary_facility_id FROM public.users WHERE id = auth.uid() AND primary_facility_id IS NOT NULL
            ) AS facilities)
        -- User and Supervisor can only access their primary facility
        ELSE
            (SELECT ARRAY[primary_facility_id] FROM public.users WHERE id = auth.uid() AND primary_facility_id IS NOT NULL)
    END;
$$;

-- Function to check if user can access a specific facility
CREATE OR REPLACE FUNCTION private.can_access_facility(facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT facility_id = ANY(private.get_user_accessible_facilities());
$$;

-- Function to check if user is superuser
CREATE OR REPLACE FUNCTION private.is_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (SELECT role FROM public.users WHERE id = auth.uid()) = 'superuser';
$$;

-- Function to check if user is supervisor or higher
CREATE OR REPLACE FUNCTION private.is_supervisor_or_higher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (SELECT role FROM public.users WHERE id = auth.uid()) IN ('supervisor', 'regional', 'superuser');
$$;

-- Function to check if user is regional or higher
CREATE OR REPLACE FUNCTION private.is_regional_or_higher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (SELECT role FROM public.users WHERE id = auth.uid()) IN ('regional', 'superuser');
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION private.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_primary_facility() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_accessible_facilities() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_facility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_superuser() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_supervisor_or_higher() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_regional_or_higher() TO authenticated;

-- =====================================================
-- PHASE 8: RLS Policies for Companies Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accessible companies" ON public.companies;
DROP POLICY IF EXISTS "Superusers can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

-- SELECT: Users can view their accessible companies
CREATE POLICY "Users can view accessible companies" ON public.companies
    FOR SELECT TO authenticated
    USING (private.can_access_facility(id) OR private.is_superuser());

-- INSERT: Only superusers can create companies
CREATE POLICY "Superusers can insert companies" ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (private.is_superuser());

-- UPDATE: Only superusers can update companies
CREATE POLICY "Superusers can update companies" ON public.companies
    FOR UPDATE TO authenticated
    USING (private.is_superuser());

-- DELETE: Only superusers can delete companies
CREATE POLICY "Superusers can delete companies" ON public.companies
    FOR DELETE TO authenticated
    USING (private.is_superuser());

-- =====================================================
-- PHASE 9: RLS Policies for User Facilities Table
-- =====================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can view user_facilities" ON public.user_facilities;
DROP POLICY IF EXISTS "Superusers can manage user_facilities" ON public.user_facilities;

-- SELECT: Users can view their own facility assignments, supervisors+ can view their facility's assignments
CREATE POLICY "Users can view user_facilities" ON public.user_facilities
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR private.is_superuser()
        OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id))
    );

-- INSERT: Only superusers can assign facilities
CREATE POLICY "Superusers can insert user_facilities" ON public.user_facilities
    FOR INSERT TO authenticated
    WITH CHECK (private.is_superuser());

-- UPDATE: Only superusers can update facility assignments
CREATE POLICY "Superusers can update user_facilities" ON public.user_facilities
    FOR UPDATE TO authenticated
    USING (private.is_superuser());

-- DELETE: Only superusers can remove facility assignments
CREATE POLICY "Superusers can delete user_facilities" ON public.user_facilities
    FOR DELETE TO authenticated
    USING (private.is_superuser());

-- =====================================================
-- PHASE 10: RLS Policies for Users Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view themselves" ON public.users;
DROP POLICY IF EXISTS "Users can update themselves" ON public.users;
DROP POLICY IF EXISTS "Supervisors can view facility users" ON public.users;
DROP POLICY IF EXISTS "Supervisors can manage facility users" ON public.users;
DROP POLICY IF EXISTS "Superusers can manage all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can delete users" ON public.users;

-- SELECT: Users can view themselves, supervisors can view facility users, superusers can view all
CREATE POLICY "Users can view users" ON public.users
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR private.is_superuser()
        OR (
            private.is_supervisor_or_higher()
            AND private.can_access_facility(primary_facility_id)
        )
    );

-- INSERT: Supervisors can create users in their facility, superusers can create anywhere
CREATE POLICY "Supervisors can insert users" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_superuser()
        OR (
            private.is_supervisor_or_higher()
            AND private.can_access_facility(primary_facility_id)
            -- Cannot create users with higher or equal role
            AND role IN ('user')
        )
    );

-- UPDATE: Users can update themselves (limited), supervisors can update facility users, superusers can update all
CREATE POLICY "Users can update users" ON public.users
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR private.is_superuser()
        OR (
            private.is_supervisor_or_higher()
            AND private.can_access_facility(primary_facility_id)
            AND role IN ('user', 'supervisor')
        )
    );

-- DELETE: Only superusers can delete users
CREATE POLICY "Superusers can delete users" ON public.users
    FOR DELETE TO authenticated
    USING (private.is_superuser());

-- =====================================================
-- PHASE 11: RLS Policies for Wings Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view wings" ON public.wings;
DROP POLICY IF EXISTS "Supervisors can manage wings" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can view wards" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can insert wards" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can update wards" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can delete wards" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can insert wings" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can update wings" ON public.wings;
DROP POLICY IF EXISTS "Authenticated users can delete wings" ON public.wings;

-- SELECT: Users can view wings in their accessible facilities
CREATE POLICY "Users can view wings" ON public.wings
    FOR SELECT TO authenticated
    USING (private.can_access_facility(facility_id) OR private.is_superuser());

-- INSERT: Supervisors+ can create wings in their facilities
CREATE POLICY "Supervisors can insert wings" ON public.wings
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_superuser()
        OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id))
    );

-- UPDATE: Supervisors+ can update wings in their facilities
CREATE POLICY "Supervisors can update wings" ON public.wings
    FOR UPDATE TO authenticated
    USING (
        private.is_superuser()
        OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id))
    );

-- DELETE: Supervisors+ can delete wings in their facilities
CREATE POLICY "Supervisors can delete wings" ON public.wings
    FOR DELETE TO authenticated
    USING (
        private.is_superuser()
        OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id))
    );

-- =====================================================
-- PHASE 12: RLS Policies for Rooms Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Supervisors can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can delete rooms" ON public.rooms;

-- SELECT: Users can view rooms via wing's facility
CREATE POLICY "Users can view rooms" ON public.rooms
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.wings w
            WHERE w.id = wing_id
            AND (private.can_access_facility(w.facility_id) OR private.is_superuser())
        )
    );

-- INSERT: Supervisors+ can create rooms
CREATE POLICY "Supervisors can insert rooms" ON public.rooms
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.wings w
            WHERE w.id = wing_id
            AND (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(w.facility_id)))
        )
    );

-- UPDATE: Supervisors+ can update rooms
CREATE POLICY "Supervisors can update rooms" ON public.rooms
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.wings w
            WHERE w.id = wing_id
            AND (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(w.facility_id)))
        )
    );

-- DELETE: Supervisors+ can delete rooms
CREATE POLICY "Supervisors can delete rooms" ON public.rooms
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.wings w
            WHERE w.id = wing_id
            AND (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(w.facility_id)))
        )
    );

-- =====================================================
-- PHASE 13: RLS Policies for Beds Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view beds" ON public.beds;
DROP POLICY IF EXISTS "Users can update beds" ON public.beds;
DROP POLICY IF EXISTS "Supervisors can manage beds" ON public.beds;
DROP POLICY IF EXISTS "Authenticated users can view beds" ON public.beds;
DROP POLICY IF EXISTS "Authenticated users can insert beds" ON public.beds;
DROP POLICY IF EXISTS "Authenticated users can update beds" ON public.beds;
DROP POLICY IF EXISTS "Authenticated users can delete beds" ON public.beds;
DROP POLICY IF EXISTS "Anonymous users can view beds" ON public.beds;

-- SELECT: Users can view beds via room->wing->facility
CREATE POLICY "Users can view beds" ON public.beds
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rooms r
            JOIN public.wings w ON w.id = r.wing_id
            WHERE r.id = room_id
            AND (private.can_access_facility(w.facility_id) OR private.is_superuser())
        )
    );

-- INSERT: Supervisors+ can create beds
CREATE POLICY "Supervisors can insert beds" ON public.beds
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rooms r
            JOIN public.wings w ON w.id = r.wing_id
            WHERE r.id = room_id
            AND (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(w.facility_id)))
        )
    );

-- UPDATE: Users can update bed status (for assignments), supervisors can do full updates
CREATE POLICY "Users can update beds" ON public.beds
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rooms r
            JOIN public.wings w ON w.id = r.wing_id
            WHERE r.id = room_id
            AND (private.can_access_facility(w.facility_id) OR private.is_superuser())
        )
    );

-- DELETE: Supervisors+ can delete beds
CREATE POLICY "Supervisors can delete beds" ON public.beds
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rooms r
            JOIN public.wings w ON w.id = r.wing_id
            WHERE r.id = room_id
            AND (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(w.facility_id)))
        )
    );

-- =====================================================
-- PHASE 14: RLS Policies for Residents Table
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view residents" ON public.residents;
DROP POLICY IF EXISTS "Users can create residents" ON public.residents;
DROP POLICY IF EXISTS "Users can update residents" ON public.residents;
DROP POLICY IF EXISTS "Supervisors can delete residents" ON public.residents;
DROP POLICY IF EXISTS "Authenticated users can view residents" ON public.residents;
DROP POLICY IF EXISTS "Authenticated users can insert residents" ON public.residents;
DROP POLICY IF EXISTS "Authenticated users can update residents" ON public.residents;
DROP POLICY IF EXISTS "Authenticated users can delete residents" ON public.residents;

-- SELECT: Users can view residents in their accessible facilities
CREATE POLICY "Users can view residents" ON public.residents
    FOR SELECT TO authenticated
    USING (private.can_access_facility(facility_id) OR private.is_superuser());

-- INSERT: Users can create residents in their accessible facilities
CREATE POLICY "Users can insert residents" ON public.residents
    FOR INSERT TO authenticated
    WITH CHECK (private.can_access_facility(facility_id) OR private.is_superuser());

-- UPDATE: Users can update residents in their accessible facilities
CREATE POLICY "Users can update residents" ON public.residents
    FOR UPDATE TO authenticated
    USING (private.can_access_facility(facility_id) OR private.is_superuser());

-- DELETE: Only supervisors+ can delete residents
CREATE POLICY "Supervisors can delete residents" ON public.residents
    FOR DELETE TO authenticated
    USING (
        private.is_superuser()
        OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id))
    );

-- =====================================================
-- PHASE 15: Enable Realtime for New Tables
-- =====================================================

-- Enable realtime for companies table
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;

-- Enable realtime for user_facilities table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_facilities;

-- =====================================================
-- PHASE 16: Create Indexes for Performance
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_wings_facility_display_order
    ON public.wings(facility_id, display_order);

CREATE INDEX IF NOT EXISTS idx_residents_facility_status
    ON public.residents(facility_id, status);

CREATE INDEX IF NOT EXISTS idx_users_facility_role
    ON public.users(primary_facility_id, role);

-- =====================================================
-- DONE
-- =====================================================
