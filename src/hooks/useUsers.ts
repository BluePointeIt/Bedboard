import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { User, UserRole, Company } from '../types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generate unique channel ID for each hook instance
let channelCounter = 0;

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  primary_facility_id?: string;
  assigned_facilities?: string[];
}

export interface UpdateUserInput {
  full_name?: string;
  role?: UserRole;
  primary_facility_id?: string;
}

export interface UseUsersOptions {
  /** Filter users by accessible facility IDs (for scoped viewing) */
  facilityIds?: string[];
}

export interface UserWithFacility extends User {
  primary_facility?: Company;
}

export function useUsers(options?: UseUsersOptions) {
  const facilityIds = options?.facilityIds;
  const [users, setUsers] = useState<UserWithFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(`users-changes-${++channelCounter}-${Date.now()}`);

  const fetchUsers = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from('users')
      .select(`
        *,
        primary_facility:companies!users_primary_facility_id_fkey(*)
      `)
      .order('full_name');

    // Filter by facility IDs if provided
    if (facilityIds && facilityIds.length > 0) {
      query = query.in('primary_facility_id', facilityIds);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Process the data to extract primary_facility properly
    const processedUsers: UserWithFacility[] = (data || []).map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role as UserRole,
      primary_facility_id: user.primary_facility_id,
      is_active: user.is_active ?? true,
      created_at: user.created_at,
      updated_at: user.updated_at,
      primary_facility: user.primary_facility as Company | undefined,
    }));

    setUsers(processedUsers);
    setLoading(false);
  }, [facilityIds]);

  useEffect(() => {
    fetchUsers();

    // Subscribe to changes
    if (supabaseConfigured) {
      const channel = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users' },
          () => fetchUsers()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, updates: UpdateUserInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
    }

    return { error };
  }, [fetchUsers]);

  const toggleUserStatus = useCallback(async (userId: string, isActive: boolean) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
    }

    return { error };
  }, [fetchUsers]);

  const createUser = useCallback(async (input: CreateUserInput) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase not configured'), data: null };
    }

    try {
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { error: new Error('Not authenticated'), data: null };
      }

      // Call the edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(input),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { error: new Error(result.error || 'Failed to create user'), data: null };
      }

      await fetchUsers();
      return { error: null, data: result.user };
    } catch (err) {
      return { error: err as Error, data: null };
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    createUser,
    updateUser,
    toggleUserStatus,
  };
}
