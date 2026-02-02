-- LLM Usage Tracking for Cost Monitoring
-- Tracks token usage and costs for Bedrock API calls

-- LLM usage logs
CREATE TABLE IF NOT EXISTS llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Operation details
  operation_type TEXT NOT NULL CHECK (operation_type IN ('chat', 'planning', 'explanation', 'optimization')),
  model_id TEXT NOT NULL,

  -- Token usage
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost tracking (in USD)
  input_cost REAL NOT NULL,
  output_cost REAL NOT NULL,
  total_cost REAL GENERATED ALWAYS AS (input_cost + output_cost) STORED,

  -- Request metadata
  request_duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_project_id ON llm_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_operation_type ON llm_usage(operation_type);

-- Row Level Security
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own usage" ON llm_usage;
DROP POLICY IF EXISTS "Service role can insert usage" ON llm_usage;

-- Users can only view their own usage
CREATE POLICY "Users can view own usage" ON llm_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only backend can insert usage logs (via service role key)
CREATE POLICY "Service role can insert usage" ON llm_usage FOR INSERT
  WITH CHECK (true);

-- Create a view for aggregated usage statistics
CREATE OR REPLACE VIEW llm_usage_stats AS
SELECT
  user_id,
  project_id,
  operation_type,
  DATE(created_at) as usage_date,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost,
  AVG(request_duration_ms) as avg_duration_ms
FROM llm_usage
WHERE success = true
GROUP BY user_id, project_id, operation_type, DATE(created_at);

-- Grant access to the view
GRANT SELECT ON llm_usage_stats TO authenticated;
