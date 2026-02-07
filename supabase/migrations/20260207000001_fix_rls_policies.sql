-- =====================================================
-- Fix RLS Policies - Remove Permissive Policies
-- =====================================================
-- This migration removes old permissive policies that were
-- bypassing the facility-based RLS filtering.
-- =====================================================

-- Remove permissive policies that bypass facility-based RLS on wings
DROP POLICY IF EXISTS "Allow anon read access" ON public.wings;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.wings;

-- Remove permissive policies on rooms
DROP POLICY IF EXISTS "Allow anon read access" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.rooms;

-- Remove permissive policies on beds
DROP POLICY IF EXISTS "Allow anon read access" ON public.beds;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.beds;
DROP POLICY IF EXISTS "Anonymous users can view beds" ON public.beds;

-- Remove permissive policies on residents
DROP POLICY IF EXISTS "Allow anon read access" ON public.residents;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.residents;

-- =====================================================
-- DONE
-- =====================================================
