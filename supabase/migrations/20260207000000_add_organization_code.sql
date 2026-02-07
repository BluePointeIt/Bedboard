-- =====================================================
-- Add Organization Code to Companies Table
-- =====================================================
-- This migration adds an organization_code column to group
-- facilities by organization. Regional managers can be
-- assigned to multiple facilities within the same organization.
-- =====================================================

-- Add organization_code column to companies table
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS organization_code TEXT;

-- Create index for faster organization lookups
CREATE INDEX IF NOT EXISTS idx_companies_organization_code
    ON public.companies(organization_code);

-- Update existing facilities to use their facility_code as organization_code
-- This ensures backward compatibility
UPDATE public.companies
SET organization_code = facility_code
WHERE organization_code IS NULL;

-- =====================================================
-- DONE
-- =====================================================
