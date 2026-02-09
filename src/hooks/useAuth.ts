import { useState, useEffect, useRef, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User, Company } from '../types';

/**
 * Helper to extract a single record from a Supabase relation
 * that may be typed as an array due to type inference.
 */
function extractSingleRelation<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

// Generate unique channel IDs for real-time subscriptions
let authChannelCounter = 0;

interface AuthState {
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  currentFacility: Company | null;
  accessibleFacilities: Company[];
}

/**
 * useAuth hook - provides authentication state and methods
 *
 * This hook can be used standalone or with AuthProvider.
 * When used with AuthProvider, prefer useAuthContext for full functionality.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    currentFacility: null,
    accessibleFacilities: [],
  });
  const profileFetchedRef = useRef<string | null>(null);
  const facilitiesFetchedRef = useRef<string | null>(null);
  const channelIdRef = useRef(`auth-facilities-${++authChannelCounter}-${Date.now()}`);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
      }));

      if (session?.user && profileFetchedRef.current !== session.user.id) {
        fetchProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
      }));

      if (session?.user && profileFetchedRef.current !== session.user.id) {
        fetchProfile(session.user.id);
      } else if (!session?.user) {
        profileFetchedRef.current = null;
        facilitiesFetchedRef.current = null;
        setState((prev) => ({
          ...prev,
          profile: null,
          currentFacility: null,
          accessibleFacilities: [],
        }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Refetch accessible facilities (called on initial load and real-time updates)
  const refetchAccessibleFacilities = useCallback(async (userId: string, role: string, isInitialFetch = false) => {
    // Only skip if it's the initial fetch and we've already fetched for this user
    if (isInitialFetch && facilitiesFetchedRef.current === userId) return;
    if (isInitialFetch) {
      facilitiesFetchedRef.current = userId;
    }

    try {
      let facilities: Company[] = [];

      if (role === 'superuser') {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Superuser facilities fetch error:', error);
        }
        if (data) {
          facilities = data;
        }
      } else if (role === 'regional') {
        const { data: userFacilitiesData } = await supabase
          .from('user_facilities')
          .select(`
            *,
            facility:companies(*)
          `)
          .eq('user_id', userId);

        const { data: primaryData } = await supabase
          .from('users')
          .select('primary_facility:companies!users_primary_facility_id_fkey(*)')
          .eq('id', userId)
          .single();

        const facilityMap = new Map<string, Company>();

        const primaryFacility = extractSingleRelation(primaryData?.primary_facility) as Company | null;
        if (primaryFacility) {
          facilityMap.set(primaryFacility.id, primaryFacility);
        }

        if (userFacilitiesData) {
          for (const uf of userFacilitiesData) {
            const facility = extractSingleRelation(uf.facility) as Company | null;
            if (facility) {
              facilityMap.set(facility.id, facility);
            }
          }
        }

        facilities = Array.from(facilityMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      } else {
        const { data } = await supabase
          .from('users')
          .select('primary_facility:companies!users_primary_facility_id_fkey(*)')
          .eq('id', userId)
          .single();

        const primaryFacility = extractSingleRelation(data?.primary_facility) as Company | null;
        if (primaryFacility) {
          facilities = [primaryFacility];
        }
      }

      setState((prev) => {
        // Update currentFacility if it was updated in the facilities list
        let updatedCurrentFacility = prev.currentFacility;
        if (prev.currentFacility) {
          const updatedFacility = facilities.find(f => f.id === prev.currentFacility?.id);
          if (updatedFacility) {
            updatedCurrentFacility = updatedFacility;
          }
        }

        return {
          ...prev,
          accessibleFacilities: facilities,
          currentFacility: updatedCurrentFacility || facilities[0] || null,
        };
      });
    } catch (err) {
      console.warn('Error fetching accessible facilities:', err);
    }
  }, []);

  // Legacy function for initial fetch
  async function fetchAccessibleFacilities(userId: string, role: string) {
    return refetchAccessibleFacilities(userId, role, true);
  }

  // Fetch user profile
  async function fetchProfile(userId: string) {
    if (profileFetchedRef.current === userId) return;
    profileFetchedRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          primary_facility:companies!users_primary_facility_id_fkey(*)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Could not fetch user profile:', error.message, error);
        return;
      }

      if (data) {
        const profileData: User = {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          primary_facility_id: data.primary_facility_id,
          is_active: data.is_active ?? true,
          created_at: data.created_at,
          updated_at: data.updated_at,
          primary_facility: data.primary_facility as Company | undefined,
        };

        setState((prev) => ({
          ...prev,
          profile: profileData,
          currentFacility: data.primary_facility as Company | null,
        }));

        // Fetch accessible facilities
        fetchAccessibleFacilities(userId, profileData.role);
      }
    } catch (err) {
      console.warn('Error fetching profile:', err);
    }
  }

  // Real-time subscription for facility changes
  useEffect(() => {
    if (!state.profile?.id || !state.profile?.role) return;

    const userId = state.profile.id;
    const role = state.profile.role;

    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => {
          // Refetch facilities when any company changes
          refetchAccessibleFacilities(userId, role, false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_facilities' },
        () => {
          // Refetch facilities when user_facilities changes (for regional users)
          if (role === 'regional') {
            refetchAccessibleFacilities(userId, role, false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.profile?.id, state.profile?.role, refetchAccessibleFacilities]);

  function setCurrentFacility(facility: Company) {
    const hasAccess = state.accessibleFacilities.some(f => f.id === facility.id);
    if (hasAccess) {
      setState((prev) => ({ ...prev, currentFacility: facility }));
      localStorage.setItem('currentFacilityId', facility.id);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      localStorage.removeItem('currentFacilityId');
    }
    return { error };
  }

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    currentFacility: state.currentFacility,
    accessibleFacilities: state.accessibleFacilities,
    setCurrentFacility,
    signIn,
    signUp,
    signOut,
  };
}
