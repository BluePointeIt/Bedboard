-- =====================================================
-- Add Total Beds to Facilities
-- =====================================================
-- This migration adds a total_beds column to the companies table
-- to track the licensed/budgeted bed count for each facility.
-- =====================================================

-- Add total_beds column to companies table
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS total_beds INTEGER DEFAULT 0;

-- Add a check constraint to ensure total_beds is non-negative
ALTER TABLE public.companies
    ADD CONSTRAINT companies_total_beds_non_negative CHECK (total_beds >= 0);

-- =====================================================
-- DONE
-- =====================================================
