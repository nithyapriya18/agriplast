/**
 * Default initial chat message for polyhouse planning
 * This replaces all hardcoded defaults - everything must come from this message
 */

/**
 * Generate the comprehensive default initial chat message
 * This is a very long and detailed instruction that will be sent to the backend
 * and executed by the agent. It contains all the default configuration.
 */
export function getDefaultInitialChatMessage(): string {
  return `Please plan and place polyhouses on this land polygon following these comprehensive specifications:

CONSTRAINTS:
- Maximum dimension (either length or width) for any polyhouse: 100 meters
- Minimum dimension (either length or width) for any polyhouse: 16 meters
- Gutter border around each polyhouse: 2 meters on all sides
- Ensure polyhouses do not overlap with each other
- Maintain proper spacing between adjacent polyhouses

TERRAIN ANALYSIS:
- Check for water coverage when placing blocks - exclude any areas identified as water bodies
- Analyze terrain slope and avoid placing polyhouses on slopes that are too steep
- Consider elevation data to ensure proper drainage

ORIENTATION:
- Optimize polyhouse orientation based on the latitude of the land
- For most latitudes, use east-west orientation (90 degrees) for optimal sun exposure
- Adjust orientation if needed based on local conditions and terrain

PLACEMENT STRATEGY:
- Maximize coverage of the buildable area while respecting all constraints
- Group polyhouses efficiently to minimize wasted space
- Ensure all polyhouses are fully contained within the land polygon boundaries
- Avoid placing polyhouses in unbuildable regions (water, steep slopes, etc.)

OUTPUT REQUIREMENTS:
- Provide detailed statistics including:
  * Total number of polyhouse groups
  * Total number of individual blocks
  * Total land area in square meters and acres
  * Total polyhouse coverage area in square meters and acres
  * Coverage percentage
  * Connection statistics (90°, 180°, 270° angles)

Please execute this plan step by step, showing your progress as you:
1. Load and analyze terrain data
2. Identify buildable and unbuildable regions
3. Calculate optimal orientation
4. Place polyhouses according to constraints
5. Analyze connections and generate statistics
6. Finalize the layout

Begin execution now.`;
}

/**
 * Get a shorter version for display in chat (first few lines)
 */
export function getDefaultInitialChatMessagePreview(): string {
  const full = getDefaultInitialChatMessage();
  const lines = full.split('\n');
  return lines.slice(0, 5).join('\n') + '\n...';
}
