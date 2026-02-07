-- =====================================================
-- Add Facility Scoping to Facility Settings
-- =====================================================
-- This migration adds facility_id to facility_settings table
-- so each facility has its own settings (budget, etc).
-- New facilities start with no settings (clean slate).
-- =====================================================

-- Add facility_id to facility_settings table
ALTER TABLE public.facility_settings
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_facility_settings_facility_id
    ON public.facility_settings(facility_id);

-- Create unique constraint for setting_key per facility
ALTER TABLE public.facility_settings
    DROP CONSTRAINT IF EXISTS facility_settings_setting_key_key;

ALTER TABLE public.facility_settings
    ADD CONSTRAINT facility_settings_facility_key_unique UNIQUE (facility_id, setting_key);

-- Assign existing settings to default facility
UPDATE public.facility_settings
SET facility_id = 'a0000000-0000-0000-0000-000000000001'
WHERE facility_id IS NULL;

-- Enable RLS on facility_settings if not already
ALTER TABLE public.facility_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view facility settings" ON public.facility_settings;
DROP POLICY IF EXISTS "Supervisors can manage facility settings" ON public.facility_settings;

-- Create RLS policies for facility_settings
CREATE POLICY "Users can view facility settings" ON public.facility_settings
    FOR SELECT TO authenticated
    USING (private.can_access_facility(facility_id) OR private.is_superuser());

CREATE POLICY "Supervisors can manage facility settings" ON public.facility_settings
    FOR ALL TO authenticated
    USING (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id)))
    WITH CHECK (private.is_superuser() OR (private.is_supervisor_or_higher() AND private.can_access_facility(facility_id)));

-- =====================================================
-- DONE
-- =====================================================
