// Supabase Edge Function for Authentication
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Define response types
interface ErrorResponse {
  error: {
    message: string;
    code: string;
  };
}

interface SuccessResponse {
  data: any;
  status: number;
}

type ApiResponse = ErrorResponse | SuccessResponse;

// Create a Supabase client
const createSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader || '' },
      },
    }
  )
  return supabaseClient
}

// Helper to handle errors
const handleError = (message: string, code: string): ErrorResponse => {
  return {
    error: {
      message,
      code
    }
  }
}

// Helper to handle success
const handleSuccess = (data: any, status = 200): SuccessResponse => {
  return {
    data,
    status
  }
}

// Process requests
const handleRequest = async (req: Request): Promise<ApiResponse> => {
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || ''
  
  // Options: signup, signin, signout, user, reset-password
  switch (path) {
    case 'signup':
      return handleSignUp(req)
    case 'signin':
      return handleSignIn(req)
    case 'signout':
      return handleSignOut(req)
    case 'user':
      return handleGetUser(req)
    case 'reset-password':
      return handleResetPassword(req)
    default:
      return handleError('Invalid endpoint', 'INVALID_ENDPOINT')
  }
}

// Handle sign up
const handleSignUp = async (req: Request): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { email, password, username, displayName } = await req.json()
    
    if (!email || !password) {
      return handleError('Email and password are required', 'MISSING_FIELDS')
    }
    
    const supabase = createSupabaseClient(req)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName
        }
      }
    })
    
    if (error) {
      return handleError(error.message, 'SIGNUP_ERROR')
    }
    
    return handleSuccess({ user: data.user })
  } catch (error) {
    return handleError('Failed to process signup', 'INTERNAL_ERROR')
  }
}

// Handle sign in
const handleSignIn = async (req: Request): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return handleError('Email and password are required', 'MISSING_FIELDS')
    }
    
    const supabase = createSupabaseClient(req)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      return handleError(error.message, 'SIGNIN_ERROR')
    }
    
    // Get the user profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user?.id)
      .single()
    
    if (profileError) {
      console.error('Error fetching profile:', profileError)
    }
    
    return handleSuccess({
      user: data.user,
      profile: profileData || null,
      session: data.session
    })
  } catch (error) {
    return handleError('Failed to process signin', 'INTERNAL_ERROR')
  }
}

// Handle sign out
const handleSignOut = async (req: Request): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const supabase = createSupabaseClient(req)
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      return handleError(error.message, 'SIGNOUT_ERROR')
    }
    
    return handleSuccess({ message: 'Successfully signed out' })
  } catch (error) {
    return handleError('Failed to process signout', 'INTERNAL_ERROR')
  }
}

// Handle get user
const handleGetUser = async (req: Request): Promise<ApiResponse> => {
  if (req.method !== 'GET') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const supabase = createSupabaseClient(req)
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      return handleError(error.message, 'GET_USER_ERROR')
    }
    
    if (!user) {
      return handleError('User not found', 'USER_NOT_FOUND')
    }
    
    // Get the user profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (profileError) {
      console.error('Error fetching profile:', profileError)
    }
    
    return handleSuccess({
      user,
      profile: profileData || null
    })
  } catch (error) {
    return handleError('Failed to get user', 'INTERNAL_ERROR')
  }
}

// Handle password reset
const handleResetPassword = async (req: Request): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { email } = await req.json()
    
    if (!email) {
      return handleError('Email is required', 'MISSING_FIELDS')
    }
    
    const supabase = createSupabaseClient(req)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    
    if (error) {
      return handleError(error.message, 'RESET_PASSWORD_ERROR')
    }
    
    return handleSuccess({ message: 'Password reset email sent' })
  } catch (error) {
    return handleError('Failed to process password reset', 'INTERNAL_ERROR')
  }
}

// Main handler
serve(async (req) => {
  const response = await handleRequest(req)
  
  return new Response(
    JSON.stringify(response),
    { 
      headers: { 'Content-Type': 'application/json' },
      status: 'error' in response ? 400 : response.status
    }
  )
})