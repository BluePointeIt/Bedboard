import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ROLE_HIERARCHY = ['user', 'supervisor', 'regional', 'superuser'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: object, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY.indexOf(role);
}

function canAssignRole(callerRole: string, targetRole: string): boolean {
  if (callerRole === 'superuser') return true;
  return getRoleLevel(callerRole) > getRoleLevel(targetRole);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create client with user's token to verify permissions
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the caller's user data
    const { data: { user: callerAuth }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerAuth) {
      return jsonResponse({ error: 'Invalid authorization' }, 401);
    }

    // Get caller's profile to check permissions
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, role, primary_facility_id, is_active')
      .eq('id', callerAuth.id)
      .single();

    if (profileError || !callerProfile) {
      return jsonResponse({ error: 'Could not fetch caller profile' }, 403);
    }

    // Check if caller is active
    if (!callerProfile.is_active) {
      return jsonResponse({ error: 'Your account is disabled' }, 403);
    }

    // Check if caller has manage:users permission (supervisor or higher)
    const callerLevel = getRoleLevel(callerProfile.role);
    if (callerLevel < getRoleLevel('supervisor')) {
      return jsonResponse({ error: 'Insufficient permissions to create users' }, 403);
    }

    // Parse request body
    const body = await req.json();
    const { email, password, full_name, role, organization_code, primary_facility_id, assigned_facilities } = body;

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return jsonResponse({ error: 'Missing required fields: email, password, full_name, role' }, 400);
    }

    // Validate role assignment
    if (!canAssignRole(callerProfile.role, role)) {
      return jsonResponse({ error: 'You cannot assign this role' }, 403);
    }

    // For non-superusers, validate facility access
    if (callerProfile.role !== 'superuser') {
      // Supervisor can only create users in their own facility
      if (callerProfile.role === 'supervisor') {
        if (primary_facility_id && primary_facility_id !== callerProfile.primary_facility_id) {
          return jsonResponse({ error: 'You can only create users in your own facility' }, 403);
        }
      }

      // Regional users can only create users in their assigned facilities
      if (callerProfile.role === 'regional') {
        // Get caller's accessible facilities
        const { data: callerFacilities } = await supabaseAdmin
          .from('user_facilities')
          .select('facility_id')
          .eq('user_id', callerAuth.id);

        const accessibleIds = [
          callerProfile.primary_facility_id,
          ...(callerFacilities?.map(f => f.facility_id) || [])
        ].filter(Boolean);

        if (primary_facility_id && !accessibleIds.includes(primary_facility_id)) {
          return jsonResponse({ error: 'You can only create users in your assigned facilities' }, 403);
        }
      }
    }

    // Create auth user
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
      },
    });

    if (createAuthError || !authData.user) {
      return jsonResponse({ error: createAuthError?.message || 'Failed to create auth user' }, 400);
    }

    // Update public.users entry (trigger already created it)
    const { error: createUserError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        role,
        organization_code: organization_code || null,
        primary_facility_id: primary_facility_id || null,
        is_active: true,
      })
      .eq('id', authData.user.id);

    if (createUserError) {
      // Rollback: delete auth user if public.users insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return jsonResponse({ error: createUserError.message }, 400);
    }

    // If regional user, create user_facilities entries
    if (role === 'regional' && assigned_facilities && Array.isArray(assigned_facilities)) {
      const facilityEntries = assigned_facilities
        .filter((fid: string) => fid !== primary_facility_id) // Exclude primary facility
        .map((facility_id: string) => ({
          user_id: authData.user.id,
          facility_id,
        }));

      if (facilityEntries.length > 0) {
        const { error: facilitiesError } = await supabaseAdmin
          .from('user_facilities')
          .insert(facilityEntries);

        if (facilitiesError) {
          console.warn('Failed to assign facilities:', facilitiesError.message);
          // Don't fail the whole operation for this
        }
      }
    }

    return jsonResponse({
      success: true,
      user: {
        id: authData.user.id,
        email,
        full_name,
        role,
        primary_facility_id,
      },
    });
  } catch (err) {
    console.error('Error in create-user function:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
