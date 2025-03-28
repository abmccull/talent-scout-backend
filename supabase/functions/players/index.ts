// Supabase Edge Function for Player Generation
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Common helper types and functions
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

// Create a Supabase client with auth
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
    
    // Available endpoints: generate, getByRegion, getByPosition
    switch (path) {
      case 'generate':
        return handleGeneratePlayer(req, supabase, user.id)
      case 'getByRegion':
        return handleGetPlayersByRegion(req, supabase)
      case 'getByPosition':
        return handleGetPlayersByPosition(req, supabase)
      default:
        return handleError('Invalid endpoint', 'INVALID_ENDPOINT')
    }
  } catch (error) {
    return handleError(error.message || 'Authentication error', 'AUTH_ERROR')
  }
}

// Generate player name based on region
const generatePlayerName = (region: string): string => {
  // In a real implementation, this would use region-specific name data
  // For now, we'll use some basic patterns
  const firstNames: Record<string, string[]> = {
    'england': ['Harry', 'John', 'James', 'Adam', 'Jack', 'Thomas', 'William'],
    'spain': ['Javier', 'Carlos', 'Antonio', 'Miguel', 'David', 'Juan', 'Sergio'],
    'germany': ['Hans', 'Thomas', 'Franz', 'Lukas', 'Felix', 'Jonas', 'Paul'],
    'italy': ['Marco', 'Antonio', 'Giuseppe', 'Andrea', 'Federico', 'Mario', 'Alessandro'],
    'france': ['Jean', 'Antoine', 'Pierre', 'Nicolas', 'Paul', 'Hugo', 'Louis'],
    'brazil': ['Carlos', 'Rafael', 'Gustavo', 'Roberto', 'Thiago', 'Gabriel', 'Lucas'],
    'argentina': ['Lionel', 'Diego', 'Sergio', 'Juan', 'Gabriel', 'Nicolas', 'Roberto'],
    // Add more regions as needed
  };
  
  const lastNames: Record<string, string[]> = {
    'england': ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson'],
    'spain': ['Garcia', 'Rodriguez', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez', 'Perez'],
    'germany': ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner'],
    'italy': ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo'],
    'france': ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit'],
    'brazil': ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida'],
    'argentina': ['Gonzalez', 'Rodriguez', 'Fernandez', 'Lopez', 'Martinez', 'Garcia', 'Sanchez'],
    // Add more regions as needed
  };
  
  // Default to english names if region not found
  const regionFirstNames = firstNames[region] || firstNames['england'];
  const regionLastNames = lastNames[region] || lastNames['england'];
  
  const firstName = regionFirstNames[Math.floor(Math.random() * regionFirstNames.length)];
  const lastName = regionLastNames[Math.floor(Math.random() * regionLastNames.length)];
  
  return `${firstName} ${lastName}`;
}

// Generate player age with weighted distribution (more young players for scouting)
const generatePlayerAge = (): number => {
  // Weight towards younger players for scouting game
  const ageRanges = [
    { min: 16, max: 19, weight: 0.4 }, // 40% chance of 16-19
    { min: 20, max: 23, weight: 0.3 }, // 30% chance of 20-23
    { min: 24, max: 27, weight: 0.2 }, // 20% chance of 24-27
    { min: 28, max: 35, weight: 0.1 }, // 10% chance of 28-35
  ];
  
  const random = Math.random();
  let weightSum = 0;
  
  for (const range of ageRanges) {
    weightSum += range.weight;
    if (random <= weightSum) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
  }
  
  // Fallback (should never reach here, but just in case)
  return Math.floor(Math.random() * (35 - 16 + 1)) + 16;
}

// Generate player position
const generatePlayerPosition = (): string => {
  const positions = [
    'GK', // Goalkeeper
    'CB', 'RB', 'LB', // Defenders
    'CDM', 'CM', 'CAM', 'RM', 'LM', // Midfielders
    'RW', 'LW', 'ST', 'CF' // Forwards
  ];
  
  return positions[Math.floor(Math.random() * positions.length)];
}

// Generate player attributes based on position and scout skills
const generatePlayerAttributes = (position: string, scoutSkills: any = {}): any => {
  // Base attribute ranges (1-10 scale)
  const baseRanges = {
    'technical': { min: 3, max: 9 },
    'physical': { min: 3, max: 9 },
    'mental': { min: 3, max: 9 }
  };
  
  // Position-specific attribute boosts
  const positionBoosts: Record<string, Record<string, number>> = {
    'GK': { 'technical': 0, 'physical': 1, 'mental': 1 },
    'CB': { 'technical': 0, 'physical': 2, 'mental': 0 },
    'RB': { 'technical': 1, 'physical': 1, 'mental': 0 },
    'LB': { 'technical': 1, 'physical': 1, 'mental': 0 },
    'CDM': { 'technical': 1, 'physical': 1, 'mental': 1 },
    'CM': { 'technical': 2, 'physical': 0, 'mental': 1 },
    'CAM': { 'technical': 3, 'physical': -1, 'mental': 1 },
    'RM': { 'technical': 2, 'physical': 1, 'mental': 0 },
    'LM': { 'technical': 2, 'physical': 1, 'mental': 0 },
    'RW': { 'technical': 2, 'physical': 1, 'mental': 0 },
    'LW': { 'technical': 2, 'physical': 1, 'mental': 0 },
    'ST': { 'technical': 2, 'physical': 1, 'mental': 0 },
    'CF': { 'technical': 3, 'physical': 0, 'mental': 0 }
  };
  
  // Scout skill impact (if provided)
  const scoutImpact = {
    'goalkeeper_knowledge': position === 'GK' ? scoutSkills.goalkeeper_knowledge || 0 : 0,
    'defender_knowledge': ['CB', 'RB', 'LB'].includes(position) ? scoutSkills.defender_knowledge || 0 : 0,
    'midfielder_knowledge': ['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(position) ? scoutSkills.midfielder_knowledge || 0 : 0,
    'forward_knowledge': ['RW', 'LW', 'ST', 'CF'].includes(position) ? scoutSkills.forward_knowledge || 0 : 0,
    'talent_spotting': scoutSkills.talent_spotting || 0
  };
  
  // Calculate adjustment from scout skills (0-1 scale)
  const positionKnowledgeImpact = Math.max(
    scoutImpact.goalkeeper_knowledge,
    scoutImpact.defender_knowledge,
    scoutImpact.midfielder_knowledge,
    scoutImpact.forward_knowledge
  ) / 10;
  
  const talentSpottingImpact = scoutImpact.talent_spotting / 10;
  
  // Generate attributes
  const attributes: Record<string, number> = {};
  
  for (const [attr, range] of Object.entries(baseRanges)) {
    const boost = positionBoosts[position]?.[attr] || 0;
    
    // Calculate adjusted min and max for this attribute
    let min = range.min + boost;
    let max = range.max + boost;
    
    // Apply scout knowledge to narrow the range (better accuracy)
    const scoutAdjustment = positionKnowledgeImpact * 2; // 0-2 point adjustment
    min = Math.max(1, min);
    max = Math.min(10, max);
    
    // Apply talent spotting to potentially find better players
    const talentBoost = Math.floor(talentSpottingImpact * 3); // 0-3 point boost
    max = Math.min(10, max + talentBoost);
    
    // Generate the attribute value
    attributes[attr] = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  return attributes;
}

// Generate player potential based on age and scout skills
const generatePlayerPotential = (age: number, scoutSkills: any = {}): number => {
  // Base potential ranges (1-10 scale)
  const baseRange = { min: 5, max: 9 };
  
  // Age impacts potential ceiling
  const ageFactor = Math.max(0, 1 - (age - 16) / 14); // 1.0 at age 16, 0.0 at age 30+
  
  // Scout skill impact
  const potentialAssessmentSkill = (scoutSkills.player_potential || 0) / 10; // 0-1 scale
  
  // Adjust range based on age
  let min = baseRange.min;
  let max = baseRange.max - (1 - ageFactor) * 3; // Up to 3 points lower for older players
  
  // Apply potential assessment skill to narrow the range (better accuracy)
  const rangeReduction = potentialAssessmentSkill * 2; // 0-2 point reduction in range
  min = Math.max(1, min);
  max = Math.min(10, max);
  
  // Generate the potential value
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate scouting report
const generateScoutingReport = (player: any, scoutSkills: any = {}): any => {
  // Base report accuracy 
  const baseAccuracy = 0.7; // 70% accuracy
  
  // Scout skill impact on accuracy
  const talentSpottingImpact = (scoutSkills.talent_spotting || 0) / 10; // 0-1 scale
  const potentialAssessmentImpact = (scoutSkills.player_potential || 0) / 10; // 0-1 scale
  
  // Calculate position-specific knowledge
  let positionKnowledgeImpact = 0;
  if (player.position === 'GK') {
    positionKnowledgeImpact = (scoutSkills.goalkeeper_knowledge || 0) / 10;
  } else if (['CB', 'RB', 'LB'].includes(player.position)) {
    positionKnowledgeImpact = (scoutSkills.defender_knowledge || 0) / 10;
  } else if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(player.position)) {
    positionKnowledgeImpact = (scoutSkills.midfielder_knowledge || 0) / 10;
  } else if (['RW', 'LW', 'ST', 'CF'].includes(player.position)) {
    positionKnowledgeImpact = (scoutSkills.forward_knowledge || 0) / 10;
  }
  
  // Overall accuracy (capped at 0.95)
  const attributeAccuracy = Math.min(0.95, baseAccuracy + (talentSpottingImpact * 0.15) + (positionKnowledgeImpact * 0.15));
  const potentialAccuracy = Math.min(0.95, baseAccuracy + (potentialAssessmentImpact * 0.20) + (talentSpottingImpact * 0.10));
  
  // Generate perceived attributes with some inaccuracy
  const perceivedAttributes: Record<string, number> = {};
  for (const [attr, value] of Object.entries(player.attributes)) {
    // Apply inaccuracy based on scout skills
    const maxError = 10 - Math.floor(attributeAccuracy * 10); // Max error points (0-3)
    const error = Math.floor(Math.random() * (maxError + 1)) * (Math.random() < 0.5 ? -1 : 1);
    
    // Calculate perceived value with error, and clamp between 1-10
    perceivedAttributes[attr] = Math.max(1, Math.min(10, value + error));
  }
  
  // Generate perceived potential with some inaccuracy
  const maxPotentialError = 10 - Math.floor(potentialAccuracy * 10); // Max error points (0-3)
  const potentialError = Math.floor(Math.random() * (maxPotentialError + 1)) * (Math.random() < 0.5 ? -1 : 1);
  const perceivedPotential = Math.max(1, Math.min(10, player.potential + potentialError));
  
  // Generate report text based on player attributes and scout knowledge
  const reportText = generateReportText(player, perceivedAttributes, perceivedPotential);
  
  return {
    perceivedAttributes,
    perceivedPotential,
    reportText,
    confidence: {
      attributes: Math.floor(attributeAccuracy * 100),
      potential: Math.floor(potentialAccuracy * 100)
    }
  };
}

// Generate report text
const generateReportText = (player: any, perceivedAttributes: any, perceivedPotential: number): string => {
  // Age-related comments
  const ageComments = [
    player.age < 20 ? "Very young player with time to develop." : "",
    player.age >= 20 && player.age <= 23 ? "Young player entering their development prime." : "",
    player.age > 23 && player.age <= 27 ? "Player in their prime years." : "",
    player.age > 27 ? "Experienced player with limited development potential." : ""
  ].filter(Boolean);
  
  // Attribute comments
  const attrComments = [];
  
  if (perceivedAttributes.technical >= 8) {
    attrComments.push("Technically exceptional.");
  } else if (perceivedAttributes.technical >= 6) {
    attrComments.push("Good technical ability.");
  } else if (perceivedAttributes.technical <= 4) {
    attrComments.push("Limited technical skills.");
  }
  
  if (perceivedAttributes.physical >= 8) {
    attrComments.push("Physically dominant.");
  } else if (perceivedAttributes.physical >= 6) {
    attrComments.push("Physically capable.");
  } else if (perceivedAttributes.physical <= 4) {
    attrComments.push("Physically needs development.");
  }
  
  if (perceivedAttributes.mental >= 8) {
    attrComments.push("Exceptional mental attributes.");
  } else if (perceivedAttributes.mental >= 6) {
    attrComments.push("Good mental approach.");
  } else if (perceivedAttributes.mental <= 4) {
    attrComments.push("Mental aspects need work.");
  }
  
  // Potential comments
  const potentialComments = [
    perceivedPotential >= 9 ? "Has world-class potential." : "",
    perceivedPotential === 8 ? "Could develop into an elite player." : "",
    perceivedPotential === 7 ? "Has the potential to be a very good player." : "",
    perceivedPotential === 6 ? "Decent potential to develop further." : "",
    perceivedPotential <= 5 ? "Limited potential for future growth." : ""
  ].filter(Boolean);
  
  // Position-specific comments
  const positionComment = getPositionComment(player.position, perceivedAttributes);
  
  // Combine all comments into a report
  return [
    ...ageComments,
    ...attrComments,
    positionComment,
    ...potentialComments
  ].join(" ");
}

// Get position-specific comment
const getPositionComment = (position: string, attrs: any): string => {
  if (position === 'GK') {
    return attrs.physical >= 7 ? 
      "Good physical presence in goal." : 
      "Could improve physical presence in goal.";
  } else if (['CB', 'RB', 'LB'].includes(position)) {
    return attrs.physical >= 7 ? 
      "Strong defensive attributes." : 
      "Has room to improve defensively.";
  } else if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(position)) {
    return attrs.technical >= 7 ? 
      "Technically gifted midfielder." : 
      "Midfield fundamentals could improve.";
  } else {
    return attrs.technical >= 7 ? 
      "Shows good attacking qualities." : 
      "Attacking skills need development.";
  }
}

// Handle generating a player
const handleGeneratePlayer = async (req: Request, supabase: any, userId: string): Promise<ApiResponse> => {
  if (req.method !== 'POST') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    // Get parameters from request body
    const { regionId, scoutSkills = {} } = await req.json()
    
    if (!regionId) {
      return handleError('Region ID is required', 'MISSING_FIELDS')
    }
    
    // Generate a player
    const position = generatePlayerPosition()
    const age = generatePlayerAge()
    const attributes = generatePlayerAttributes(position, scoutSkills)
    const potential = generatePlayerPotential(age, scoutSkills)
    
    const player = {
      name: generatePlayerName(regionId),
      regionId,
      age,
      position,
      attributes,
      potential
    }
    
    // Generate scouting report
    const scoutingReport = generateScoutingReport(player, scoutSkills)
    
    // Save the generated player to the database
    const { data, error } = await supabase
      .from('generated_players')
      .insert({
        name: player.name,
        region_id: player.regionId,
        age: player.age,
        position: player.position,
        attributes: player.attributes,
        potential: player.potential,
        scouting_report: scoutingReport,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error saving generated player:', error)
      // Even if saving fails, return the generated player
    }
    
    return handleSuccess({
      player: {
        ...player,
        id: data?.id || crypto.randomUUID(),
        scoutingReport
      }
    })
  } catch (error) {
    console.error('Player generation error:', error)
    return handleError('Failed to generate player', 'INTERNAL_ERROR')
  }
}

// Handle getting players by region
const handleGetPlayersByRegion = async (req: Request, supabase: any): Promise<ApiResponse> => {
  if (req.method !== 'GET') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const url = new URL(req.url)
    const regionId = url.searchParams.get('regionId')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    
    if (!regionId) {
      return handleError('Region ID is required', 'MISSING_FIELDS')
    }
    
    const { data, error } = await supabase
      .from('generated_players')
      .select('*')
      .eq('region_id', regionId)
      .limit(limit)
    
    if (error) {
      return handleError(error.message, 'GET_PLAYERS_ERROR')
    }
    
    return handleSuccess({ players: data })
  } catch (error) {
    return handleError('Failed to get players by region', 'INTERNAL_ERROR')
  }
}

// Handle getting players by position
const handleGetPlayersByPosition = async (req: Request, supabase: any): Promise<ApiResponse> => {
  if (req.method !== 'GET') {
    return handleError('Method not allowed', 'METHOD_NOT_ALLOWED')
  }
  
  try {
    const url = new URL(req.url)
    const position = url.searchParams.get('position')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    
    if (!position) {
      return handleError('Position is required', 'MISSING_FIELDS')
    }
    
    const { data, error } = await supabase
      .from('generated_players')
      .select('*')
      .eq('position', position)
      .limit(limit)
    
    if (error) {
      return handleError(error.message, 'GET_PLAYERS_ERROR')
    }
    
    return handleSuccess({ players: data })
  } catch (error) {
    return handleError('Failed to get players by position', 'INTERNAL_ERROR')
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