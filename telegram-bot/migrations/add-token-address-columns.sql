-- Migration: Add underlying_token_address and underlying_decimals to pool_cache
-- This enables dynamic token discovery for multi-chain wallet scanning

-- Add new columns
ALTER TABLE pool_cache ADD COLUMN underlying_token_address TEXT;
ALTER TABLE pool_cache ADD COLUMN underlying_decimals INTEGER DEFAULT 18;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_pool_cache_token_address
  ON pool_cache(underlying_token_address, chain_id);
