/**
 * AWS Bedrock integration for conversational AI
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ConversationMessage, PlanningResult } from '@shared/types';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    // Initialize Bedrock client
    // When AWS_PROFILE is set, credentials are automatically loaded from ~/.aws/credentials
    const clientConfig: any = {
      region: process.env.AWS_REGION || 'us-east-2',
    };

    // Only add explicit credentials if provided (not using AWS_PROFILE)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);

    // Use model from config (defaults to Claude Haiku 4.5 global profile)
    this.modelId = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

    console.log(`Bedrock initialized with model: ${this.modelId} in region: ${clientConfig.region}`);
  }

  /**
   * Handle conversational interaction about polyhouse planning
   */
  async handleConversation(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    currentPlan?: PlanningResult,
    customerPreferences?: any
  ): Promise<{ response: string; requiresRecalculation: boolean; updatedConfig?: any; usage?: TokenUsage }> {
    // Build system prompt with context about the current plan and customer preferences
    const systemPrompt = this.buildSystemPrompt(currentPlan, customerPreferences);

    // Build conversation messages
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    try {
      // Invoke Bedrock
      const { text: response, usage } = await this.invokeModel(systemPrompt, messages);

      // Parse response to check if recalculation is needed
      const requiresRecalculation = this.checkIfRecalculationNeeded(response);

      // Extract any configuration changes
      const updatedConfig = this.extractConfigurationChanges(response, currentPlan);

      return {
        response,
        requiresRecalculation,
        updatedConfig,
        usage,
      };
    } catch (error) {
      console.error('Bedrock invocation error:', error);
      throw new Error('Failed to process conversation');
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(currentPlan?: PlanningResult, customerPreferences?: any): string {
    let prompt = `You are an AI assistant for Agriplast, a company that builds polyhouses (greenhouses) for agricultural purposes.

Your role is to help users understand their polyhouse planning, answer questions about the proposed design, and PROACTIVELY make modifications to optimize their setup based on their requests.

CRITICAL BEHAVIORAL RULES - YOU MUST FOLLOW THESE EXACTLY:

1. **NEVER ASK QUESTIONS WHEN ACTION IS POSSIBLE**: When users request changes like "increase coverage", "make polyhouses bigger", "adjust layout", "fill more space" - IMMEDIATELY trigger the appropriate [RECALCULATE] tag. DO NOT ask "Would you like me to...?" or "Should I...?" or "Can I help you with...?" - JUST DO IT.

2. **BE DECISIVE AND ACTION-ORIENTED**: You are an AI agent that TAKES ACTION, not a chatbot that asks permission. Make intelligent decisions and execute them immediately.

3. **PROHIBITED PHRASES** - NEVER use these:
   - "Would you like me to..."
   - "Should I..."
   - "Do you want me to..."
   - "Can I help you..."
   - "Let me know if..."
   - "What would you prefer..."
   - "How much would you like..."

4. **CORRECT RESPONSE PATTERN**:
   ❌ WRONG: "Would you like me to increase coverage? I can recalculate..."
   ✅ CORRECT: "I'll increase coverage by recalculating with larger polyhouses. [RECALCULATE:MAXIMIZE]"

   ❌ WRONG: "How much more coverage would you like?"
   ✅ CORRECT: "Maximizing coverage now... [RECALCULATE:MAXIMIZE]"

   ❌ WRONG: "Do you want me to make the polyhouses bigger or add more?"
   ✅ CORRECT: "Optimizing for maximum coverage with larger polyhouses... [RECALCULATE:MAXIMIZE]"

5. **DEFAULT TO ACTION**: When user intent is clear (even if specific details aren't), choose reasonable defaults and take action immediately. Don't interrogate the user.

Key concepts:
- **Land Area**: The agricultural space the user has mapped
- **Polyhouse**: A rectangular greenhouse structure made of composable blocks
- **Block**: A standard 8m x 4m unit that makes up a polyhouse
- **Gutter**: A 2m wide drainage channel around each polyhouse
- **Solar Orientation**: Polyhouses should face north-south for optimal sun exposure

Current planning rules:
- Blocks are 8m x 4m standard size
- 2m gutter around each polyhouse for drainage
- Minimum 2m gap between polyhouses
- Maximum side length: 100m
- Minimum side length: 16m
- Polyhouses oriented north-south (with latitude-based adjustments)

OPTIMIZATION LEVELS - Users can request different space utilization strategies:

**Current (Balanced)**: ~50-60% utilization with quality polyhouses
- 1m gap between polyhouses
- Minimum width: 8m (2 blocks)
- Aspect ratio limit: 4:1 maximum
- Good drainage and access

**Maximum Coverage (Cost-Optimized)**: ~60-75% utilization with FEWER, LARGER polyhouses
- 1m gap between polyhouses (reasonable spacing for cost efficiency)
- Prioritizes LARGER polyhouses (lower cost per sqm to build)
- Minimum size: 24x16m (6 blocks) instead of single blocks
- Fewer polyhouses = lower infrastructure costs (foundations, gutters, entry points)

WHEN USERS REQUEST CHANGES - BE PROACTIVE AND ACTION-ORIENTED:

**Maximum Coverage/Utilization** (phrases like "maximize space", "fill more", "increase coverage", "use more land", "lower cost"):
- IMMEDIATELY trigger recalculation with "[RECALCULATE:MAXIMIZE]"
- Briefly explain: "I'll recalculate with LARGER polyhouses and optimized spacing to maximize coverage while minimizing construction costs. Fewer, larger polyhouses are more cost-effective to build and manage."
- DON'T ask "Would you like me to..." - JUST DO IT

**Other Layout Changes** (phrases like "make bigger", "adjust spacing", "change orientation", "more polyhouses"):
- IMMEDIATELY trigger recalculation with "[RECALCULATE]"
- Briefly state what you're changing
- DON'T ask for confirmation - TAKE ACTION

**Natural Conversational Requests** (e.g., "I need more space for tomatoes", "Can we fit more?", "This looks too sparse"):
- Interpret the intent (they want more coverage)
- IMMEDIATELY trigger "[RECALCULATE:MAXIMIZE]"
- Explain what you're doing: "I'll adjust the layout to give you more growing space..."

**RESTRICTED ZONES (Water, Steep Slopes, etc.):**
By default, we do NOT build on restricted areas for safety and regulatory reasons.

If users want to BUILD ON RESTRICTED ZONES (override restrictions):
1. **WARN them strongly**: "⚠️ Building on [water/steep slopes/etc] is not recommended and may violate regulations, cause structural issues, or fail inspections. You take full responsibility."
2. Explain what they need to do: "You'll need to handle leveling, drainage, foundations, and permits yourself."
3. Include "[RECALCULATE:IGNORE_RESTRICTIONS]" in your response

If users ask about restricted zones but DON'T want to override:
- Just explain what the restrictions are and why they exist
- Don't include any [RECALCULATE] tags

Format material options and prices clearly using tables or lists.`;

    // Add customer preferences context if available
    if (customerPreferences) {
      const cropTypeMap: Record<string, string> = {
        flowers: 'Flowers (roses, gerberas, carnations)',
        leafy: 'Leafy vegetables (lettuce, spinach, herbs)',
        vine: 'Vine crops (tomatoes, cucumbers, peppers)',
        mixed: 'Mixed/Multiple crops'
      };

      const polyhouseSizeMap: Record<string, string> = {
        large: 'Large polyhouses (maximize individual size)',
        mixed: 'Mixed sizes (variety of polyhouse sizes)',
        small: 'Smaller polyhouses (more units, easier management)'
      };

      const budgetMap: Record<string, string> = {
        economy: 'Economy (cost-effective materials)',
        standard: 'Standard (balanced quality and cost)',
        premium: 'Premium (high-quality materials)'
      };

      const priorityMap: Record<string, string> = {
        coverage: 'Maximum coverage (fill as much land as possible)',
        quality: 'Quality (larger, well-spaced polyhouses)',
        balanced: 'Balanced (mix of coverage and quality)'
      };

      const orientationMap: Record<string, string> = {
        uniform: 'Uniform orientation (all polyhouses same direction)',
        varied: 'Varied orientation (adapt to land shape)',
        optimized: 'Solar-optimized (best for sun exposure)'
      };

      const timelineMap: Record<string, string> = {
        urgent: 'Urgent (construction ASAP)',
        planned: 'Planned (flexible timeline)'
      };

      prompt += `\n\nUSER'S INITIAL PREFERENCES (from form):
- Crop type: ${cropTypeMap[customerPreferences.cropType] || customerPreferences.cropType}
- Polyhouse size preference: ${polyhouseSizeMap[customerPreferences.polyhouseSize] || customerPreferences.polyhouseSize}
- Budget range: ${budgetMap[customerPreferences.budgetRange] || customerPreferences.budgetRange}
- Automation: ${customerPreferences.automation ? 'Yes (wants automated systems)' : 'No (manual operation)'}
- Vehicle access required: ${customerPreferences.vehicleAccess ? 'Yes (needs wider spacing for vehicles)' : 'No'}
- Priority: ${priorityMap[customerPreferences.priority] || customerPreferences.priority}
- Orientation preference: ${orientationMap[customerPreferences.orientationPreference] || customerPreferences.orientationPreference}
- Timeline: ${timelineMap[customerPreferences.timeline] || customerPreferences.timeline}

The current design was generated based on these preferences. Don't ask the user to repeat this information.`;
    }

    if (currentPlan) {
      // Extract location and climate information
      const { lat, lng } = currentPlan.landArea.centroid;
      const climateZone = this.getClimateZone(lat);
      const solarOrientation = this.getSolarOrientationAdvice(lat);

      prompt += `\n\nLOCATION & CLIMATE CONTEXT:
- Land coordinates: ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E
- Climate zone: ${climateZone}
- Solar orientation: ${solarOrientation}

CURRENT PLAN DETAILS:
- Number of polyhouses: ${currentPlan.polyhouses.length}
- Total polyhouse area: ${currentPlan.metadata.totalPolyhouseArea.toFixed(2)} sqm
- Total land area: ${currentPlan.metadata.totalLandArea.toFixed(2)} sqm
- Space utilization: ${currentPlan.metadata.utilizationPercentage.toFixed(1)}%
- Total estimated cost: ₹${currentPlan.quotation.totalCost.toLocaleString('en-IN')}
${currentPlan.terrainAnalysis ? `
TERRAIN & RESTRICTIONS:
- Buildable area: ${(currentPlan.terrainAnalysis.buildableAreaPercentage || 0).toFixed(1)}%
- Average slope: ${(currentPlan.terrainAnalysis.averageSlope || 0).toFixed(1)}°
${currentPlan.terrainAnalysis.restrictedZones && currentPlan.terrainAnalysis.restrictedZones.length > 0 ? `- ⚠️ ${currentPlan.terrainAnalysis.restrictedZones.length} restricted zone(s) detected: ${currentPlan.terrainAnalysis.restrictedZones.map((z: any) => z.type).join(', ')}
- Currently avoiding restricted zones (user can override via chat)` : ''}
${currentPlan.terrainAnalysis.warnings && currentPlan.terrainAnalysis.warnings.length > 0 ? `- Warnings: ${currentPlan.terrainAnalysis.warnings.slice(0, 2).join('; ')}` : ''}` : ''}

The user can see a visual map of the polyhouses with restricted zones marked in RED and a detailed quotation breakdown.

When answering questions, consider the local climate and latitude when giving advice about:
- Crop recommendations for this climate zone
- Seasonal considerations
- Temperature management strategies
- Water requirements based on local conditions`;
    }

    return prompt;
  }

  /**
   * Determine climate zone based on latitude
   */
  private getClimateZone(lat: number): string {
    const absLat = Math.abs(lat);

    if (absLat >= 0 && absLat < 15) {
      return 'Tropical (hot and humid year-round, high rainfall)';
    } else if (absLat >= 15 && absLat < 25) {
      return 'Subtropical (warm summers, mild winters, moderate rainfall)';
    } else if (absLat >= 25 && absLat < 35) {
      return 'Warm temperate (hot summers, cool winters, seasonal variation)';
    } else if (absLat >= 35 && absLat < 50) {
      return 'Cool temperate (moderate summers, cold winters, four distinct seasons)';
    } else {
      return 'Cold/Polar (short cool summers, long cold winters)';
    }
  }

  /**
   * Get solar orientation advice based on latitude
   */
  private getSolarOrientationAdvice(lat: number): string {
    const absLat = Math.abs(lat);

    if (absLat < 15) {
      return 'Near equator - polyhouses should run north-south for even sunlight distribution';
    } else if (absLat < 30) {
      return 'Low to mid latitude - north-south orientation optimal with slight east-west tolerance';
    } else {
      return 'Higher latitude - north-south orientation critical for maximizing winter sun exposure';
    }
  }

  /**
   * Invoke Bedrock model
   */
  private async invokeModel(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ text: string; usage: TokenUsage }> {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages,
      temperature: 0.3, // Lower temperature for more decisive, less questioning behavior
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract token usage from response
    const usage: TokenUsage = {
      inputTokens: responseBody.usage?.input_tokens || 0,
      outputTokens: responseBody.usage?.output_tokens || 0,
      modelId: this.modelId,
    };

    return {
      text: responseBody.content[0].text,
      usage,
    };
  }

  /**
   * Check if response indicates recalculation is needed
   */
  private checkIfRecalculationNeeded(response: string): boolean {
    return response.includes('[RECALCULATE]') ||
           response.includes('[RECALCULATE:MAXIMIZE]') ||
           response.includes('[RECALCULATE:IGNORE_RESTRICTIONS]');
  }

  /**
   * Extract configuration changes from response
   */
  private extractConfigurationChanges(response: string, currentPlan?: PlanningResult): any {
    // Look for structured configuration changes in the response

    if (!currentPlan) return null;

    const changes: any = {};

    // Check for MAXIMUM COVERAGE request
    if (response.includes('[RECALCULATE:MAXIMIZE]')) {
      console.log('🚀 User requested MAXIMUM COVERAGE - optimizing for LARGER polyhouses and LOWER COST');

      // Apply COST-OPTIMIZED settings: fewer, larger polyhouses
      changes.polyhouseGap = 1.0;    // Reasonable spacing (not too tight)
      changes.minSideLength = 24;    // Minimum 3x2 blocks (24x16m) - no tiny polyhouses
      changes.minCornerDistance = 5; // Prefer simpler shapes

      // Mark this as a maximize request
      changes._maximizeCoverage = true;

      return changes;
    }

    // Check for IGNORE RESTRICTIONS override
    if (response.includes('[RECALCULATE:IGNORE_RESTRICTIONS]')) {
      console.log('⚠️  User requested to IGNORE RESTRICTED ZONES - building on restricted areas');

      // Override terrain restrictions (user takes responsibility)
      changes.terrain = {
        ...currentPlan.configuration.terrain,
        ignoreRestrictedZones: true,
      };

      return changes;
    }

    // Check for other specific changes
    if (response.toLowerCase().includes('cheaper material') ||
        response.toLowerCase().includes('change material')) {
      // Material changes would be handled separately
      // For now, we don't modify configuration for material changes
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Generate explanation of why polyhouses were placed in a certain way
   */
  async explainPlacement(planningResult: PlanningResult): Promise<{ text: string; usage: TokenUsage }> {
    const systemPrompt = `You are explaining the automated polyhouse placement algorithm to a user. Be clear and educational.`;

    const userPrompt = `Explain why the polyhouses were placed the way they are, given:
- ${planningResult.polyhouses.length} polyhouses were placed
- Total land area: ${planningResult.metadata.totalLandArea.toFixed(2)} sqm
- Total polyhouse area: ${planningResult.metadata.totalPolyhouseArea.toFixed(2)} sqm
- Space utilization: ${planningResult.metadata.utilizationPercentage.toFixed(1)}%
- Configuration: Blocks are 8m x 4m, 2m gutter, 2m gap between polyhouses

Keep the explanation concise (2-3 paragraphs) and mention the key factors like solar orientation, spacing requirements, and maximizing space.`;

    return await this.invokeModel(systemPrompt, [
      { role: 'user', content: userPrompt },
    ]);
  }
}
