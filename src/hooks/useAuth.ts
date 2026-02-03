import { useState, useEffect, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthState {
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });
  const profileFetchedRef = useRef<string | null>(null);

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
        setState((prev) => ({ ...prev, profile: null }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    // Prevent duplicate fetches for the same user
    if (profileFetchedRef.current === userId) return;
    profileFetchedRef.current = userId;

    try {
      // Use maybeSingle() instead of single() to avoid 406 errors when no rows exist
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch user profile:', error.message);
        return;
      }

      if (data) {
        setState((prev) => ({ ...prev, profile: data }));
      }
    } catch (err) {
      console.warn('Error fetching profile:', err);
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
    return { error };
  }

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    signIn,
    signUp,
    signOut,
  };
}
