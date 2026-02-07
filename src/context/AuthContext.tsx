import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
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

interface AuthContextType {
  // Auth state
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;

  // Facility state
  currentFacility: Company | null;
  accessibleFacilities: Company[];
  setCurrentFacility: (facility: Company) => void;

  // Auth methods
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;

  // Refresh methods
  refetchProfile: () => Promise<void>;
  refetchFacilities: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFacility, setCurrentFacilityState] = useState<Company | null>(null);
  const [accessibleFacilities, setAccessibleFacilities] = useState<Company[]>([]);

  const profileFetchedRef = useRef<string | null>(null);
  const facilitiesFetchedRef = useRef<string | null>(null);

  // Fetch user profile with facility data
  const fetchProfile = useCallback(async (userId: string) => {
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
        console.warn('Could not fetch user profile:', error.message);
        return;
      }

      if (data) {
        // Extract and type the profile data
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

        setProfile(profileData);

        // Set initial current facility to primary facility
        if (data.primary_facility && !currentFacility) {
          setCurrentFacilityState(data.primary_facility as Company);
        }

        // Fetch accessible facilities after profile is loaded
        fetchAccessibleFacilities(userId, profileData.role);
      }
    } catch (err) {
      console.warn('Error fetching profile:', err);
    }
  }, [currentFacility]);

  // Fetch accessible facilities based on user role
  const fetchAccessibleFacilities = useCallback(async (userId: string, role: string) => {
    if (facilitiesFetchedRef.current === userId) return;
    facilitiesFetchedRef.current = userId;

    try {
      let facilities: Company[] = [];

      if (role === 'superuser') {
        // Superusers can access all active facilities
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (!error && data) {
          facilities = data;
        }
      } else if (role === 'regional') {
        // Regional users can access assigned facilities plus primary
        const { data: userFacilitiesData } = await supabase
          .from('user_facilities')
          .select(`
            *,
            facility:companies(*)
          `)
          .eq('user_id', userId);

        // Get primary facility
        const { data: primaryData } = await supabase
          .from('users')
          .select('primary_facility:companies!users_primary_facility_id_fkey(*)')
          .eq('id', userId)
          .single();

        const facilityMap = new Map<string, Company>();

        // Add primary facility
        const primaryFacility = extractSingleRelation(primaryData?.primary_facility) as Company | null;
        if (primaryFacility) {
          facilityMap.set(primaryFacility.id, primaryFacility);
        }

        // Add assigned facilities
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
        // User and Supervisor can only access their primary facility
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

      setAccessibleFacilities(facilities);

      // Set current facility if not already set
      if (!currentFacility && facilities.length > 0) {
        setCurrentFacilityState(facilities[0]);
      }
    } catch (err) {
      console.warn('Error fetching accessible facilities:', err);
    }
  }, [currentFacility]);

  // Handle current facility change
  const setCurrentFacility = useCallback((facility: Company) => {
    // Verify user has access to this facility
    const hasAccess = accessibleFacilities.some(f => f.id === facility.id);
    if (hasAccess) {
      setCurrentFacilityState(facility);
      // Store in localStorage for persistence across page refreshes
      localStorage.setItem('currentFacilityId', facility.id);
    }
  }, [accessibleFacilities]);

  // Auth methods
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
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
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setProfile(null);
      setCurrentFacilityState(null);
      setAccessibleFacilities([]);
      profileFetchedRef.current = null;
      facilitiesFetchedRef.current = null;
      localStorage.removeItem('currentFacilityId');
    }
    return { error };
  }, []);

  // Refresh methods
  const refetchProfile = useCallback(async () => {
    if (user) {
      profileFetchedRef.current = null;
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const refetchFacilities = useCallback(async () => {
    if (user && profile) {
      facilitiesFetchedRef.current = null;
      await fetchAccessibleFacilities(user.id, profile.role);
    }
  }, [user, profile, fetchAccessibleFacilities]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user && profileFetchedRef.current !== session.user.id) {
        fetchProfile(session.user.id);
      } else if (!session?.user) {
        profileFetchedRef.current = null;
        facilitiesFetchedRef.current = null;
        setProfile(null);
        setCurrentFacilityState(null);
        setAccessibleFacilities([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Restore current facility from localStorage on mount
  useEffect(() => {
    if (accessibleFacilities.length > 0 && !currentFacility) {
      const savedFacilityId = localStorage.getItem('currentFacilityId');
      if (savedFacilityId) {
        const savedFacility = accessibleFacilities.find(f => f.id === savedFacilityId);
        if (savedFacility) {
          setCurrentFacilityState(savedFacility);
        }
      }
    }
  }, [accessibleFacilities, currentFacility]);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    currentFacility,
    accessibleFacilities,
    setCurrentFacility,
    signIn,
    signUp,
    signOut,
    refetchProfile,
    refetchFacilities,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 * Must be used within an AuthProvider
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to get just the current facility ID
 * Useful for data fetching hooks
 */
export function useCurrentFacilityId(): string | null {
  const { currentFacility } = useAuthContext();
  return currentFacility?.id ?? null;
}
