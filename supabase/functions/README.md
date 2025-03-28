# Talent Scout Supabase Edge Functions

This directory contains all the Edge Functions used by the Talent Scout game.

## Edge Functions

- `auth` - Functions related to authentication and user management
- `saves` - Functions for saving and loading game states
- `players` - Functions for generating and managing player data
- `scouts` - Functions for generating and managing scout data
- `matches` - Functions for generating and managing match data
- `simulation` - Functions for running in-game simulations

## Development

To develop and test these functions locally:

1. Install the Supabase CLI
2. Run `supabase functions serve` to start the local development server
3. Use `supabase functions deploy [function-name]` to deploy a specific function

## Authentication

Most functions require authentication. Make sure to include the Supabase JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Error Handling

All functions follow a standard error response format:

```json
{
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

## Success Responses

Successful responses will include:

```json
{
  "data": { ... },
  "status": 200
}
```