// Supabase Edge Function for Game Saves
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
  if (!authHeader) {
    throw new Error('Missing Authorization header')
  }
  
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
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
  // Check authentication
  try {
    const supabase = createSupabaseClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return handleError('Unauthorized', 'UNAUTHORIZED')
    }
    
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() || ''
    
    // Options: list, create, update, delete, get
    switch (path) {
      case 'list':
        return handleListSaves(req, supabase, user.id)
      case 'create':
        return handleCreateSave(req, supabase, user.id)
      case 'update':
        return handleUpdateSave(req, supabase, user.id)
      case 'delete':
        return handleDeleteSave(req, supabase, user.id)
      case 'get':
        return handleGetSave(req, supabase, user.id)
      default:
        return handleError('Invalid endpoint', 'INVALID_ENDPOINT')
    }
  } catch (error) {
    return handleError(error.message || 'Authentication error', 'AUTH_ERROR')
  }
}

// Handle listing saves
const handleListSaves = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'GET') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { data, error } = await supabase
      .from('saved_games')
      .select('id, name, version, is_auto_save, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    
    if (error) {
      return handleError(error.message, 'LIST_SAVES_ERROR')
    }
    
    return handleSuccess({ saves: data })
  } catch (error) {
    return handleError('Failed to list saves', 'INTERNAL_ERROR')
  }
}

// Handle creating a save
const handleCreateSave = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { name, version, isAutoSave, gameData } = await req.json()
    
    if (!name || !version || !gameData) {
      return handleError('Missing required fields', 'MISSING_FIELDS')
    }
    
    // Check if we already have an auto-save to update
    if (isAutoSave) {
      const { data: existingAutoSave } = await supabase
        .from('saved_games')
        .select('id')
        .eq('user_id', userId)
        .eq('is_auto_save', true)
        .maybeSingle()
      
      if (existingAutoSave) {
        // Update existing auto-save
        const { data, error } = await supabase
          .from('saved_games')
          .update({
            version,
            game_data: gameData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAutoSave.id)
          .select()
          .single()
        
        if (error) {
          return handleError(error.message, 'UPDATE_AUTOSAVE_ERROR')
        }
        
        return handleSuccess({ save: data })
      }
    }
    
    // Create new save
    const { data, error } = await supabase
      .from('saved_games')
      .insert({
        user_id: userId,
        name,
        version,
        is_auto_save: isAutoSave || false,
        game_data: gameData
      })
      .select()
      .single()
    
    if (error) {
      return handleError(error.message, 'CREATE_SAVE_ERROR')
    }
    
    return handleSuccess({ save: data })
  } catch (error) {
    return handleError('Failed to create save', 'INTERNAL_ERROR')
  }
}

// Handle updating a save
const handleUpdateSave = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const { id, name, version, gameData } = await req.json()
    
    if (!id) {
      return handleError('Save ID is required', 'MISSING_FIELDS')
    }
    
    // Check if the save exists and belongs to the user
    const { data: existingSave, error: fetchError } = await supabase
      .from('saved_games')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (fetchError) {
      return handleError(fetchError.message, 'FETCH_SAVE_ERROR')
    }
    
    if (!existingSave) {
      return handleError('Save not found or does not belong to user', 'SAVE_NOT_FOUND')
    }
    
    // Update fields that were provided
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (version !== undefined) updateData.version = version
    if (gameData !== undefined) updateData.game_data = gameData
    updateData.updated_at = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('saved_games')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return handleError(error.message, 'UPDATE_SAVE_ERROR')
    }
    
    return handleSuccess({ save: data })
  } catch (error) {
    return handleError('Failed to update save', 'INTERNAL_ERROR')
  }
}

// Handle deleting a save
const handleDeleteSave = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'DELETE') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return handleError('Save ID is required', 'MISSING_FIELDS')
    }
    
    // Check if the save exists and belongs to the user
    const { data: existingSave, error: fetchError } = await supabase
      .from('saved_games')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (fetchError) {
      return handleError(fetchError.message, 'FETCH_SAVE_ERROR')
    }
    
    if (!existingSave) {
      return handleError('Save not found or does not belong to user', 'SAVE_NOT_FOUND')
    }
    
    const { error } = await supabase
      .from('saved_games')
      .delete()
      .eq('id', id)
    
    if (error) {
      return handleError(error.message, 'DELETE_SAVE_ERROR')
    }
    
    return handleSuccess({ message: 'Save deleted successfully' })
  } catch (error) {
    return handleError('Failed to delete save', 'INTERNAL_ERROR')
  }
}

// Handle getting a save
const handleGetSave = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'GET') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return handleError('Save ID is required', 'MISSING_FIELDS')
    }
    
    const { data, error } = await supabase
      .from('saved_games')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    
    if (error) {
      return handleError(error.message, 'GET_SAVE_ERROR')
    }
    
    if (!data) {
      return handleError('Save not found or does not belong to user', 'SAVE_NOT_FOUND')
    }
    
    return handleSuccess({ save: data })
  } catch (error) {
    return handleError('Failed to get save', 'INTERNAL_ERROR')
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