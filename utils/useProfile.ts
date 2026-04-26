// utils/useProfile.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: number;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  is_profile_complete: boolean;
  latitude?: number;
  longitude?: number;
  avatar_locked?: boolean;
}

// In-memory cache for profile data
let profileCache: Profile | null = null;
let cacheTimestamp: number | null = null;
let cachedUserId: string | null = null; // Track which user's profile is cached
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(profileCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check if cached profile belongs to current user
    const checkAndFetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // If no user, clear cache
      if (!user) {
        if (profileCache) {
          console.log('🗑️ No user found, clearing cache');
          clearProfileCache();
          setProfile(null);
        }
        return;
      }

      // If cache exists but is for a different user, clear it
      if (cachedUserId && cachedUserId !== user.id) {
        console.log('🗑️ Different user detected, clearing old cache');
        clearProfileCache();
        setProfile(null);
      }

      // Only fetch if no cache or cache is invalid
      if (!profileCache || !isCacheValid() || cachedUserId !== user.id) {
        fetchProfile();
      } else {
        console.log('📦 Using cached profile data for current user');
        setProfile(profileCache);
      }
    };

    checkAndFetchProfile();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isCacheValid = () => {
    if (!cacheTimestamp) return false;
    return Date.now() - cacheTimestamp < CACHE_DURATION;
  };

  const fetchProfile = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Use cache if valid, for same user, and not forcing refresh
      if (!forceRefresh && profileCache && isCacheValid() && cachedUserId === user.id) {
        console.log('📦 Using cached profile data');
        if (isMountedRef.current) {
          setProfile(profileCache);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      if (data && isMountedRef.current) {
        // Update cache with new user's data
        profileCache = data;
        cacheTimestamp = Date.now();
        cachedUserId = user.id;
        
        console.log('✅ Profile loaded from server and cached for user:', user.id);
        setProfile(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile';
      console.error('Profile fetch error:', errorMessage);
      
      if (isMountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      if (data && isMountedRef.current) {
        // Update cache with new data
        profileCache = data;
        cacheTimestamp = Date.now();
        cachedUserId = user.id;
        
        console.log('✅ Profile updated and cache refreshed');
        setProfile(data);
      }

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      console.error('Profile update error:', errorMessage);
      
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      
      return { success: false, error: errorMessage };
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const clearCache = () => {
    profileCache = null;
    cacheTimestamp = null;
    cachedUserId = null;
    console.log('🗑️ Profile cache cleared');
  };

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    clearCache,
  };
}

// Export function to clear cache on logout
export const clearProfileCache = () => {
  profileCache = null;
  cacheTimestamp = null;
  cachedUserId = null;
  console.log('🗑️ Profile cache cleared (global)');
};