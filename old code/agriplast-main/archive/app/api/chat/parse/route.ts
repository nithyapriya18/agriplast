import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/middleware/auth';
import { validateChatMessage, validateRuleData } from '@/lib/utils/validation';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * API endpoint for parsing user chat messages using LLM
 * This uses OpenAI API to parse natural language into structured rules
 * Requires authentication
 */

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const userEmail = getAuthenticatedUser(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting (100 requests per minute per user)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const identifier = `${userEmail}:${ip}`;
    const rateLimit = checkRateLimit(identifier, 100, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
      );
    }

    const body = await request.json();
    const { message, currentPolyhouses, chatHistory } = body;

    // Validate and sanitize message
    const messageValidation = validateChatMessage(message);
    if (!messageValidation.valid) {
      return NextResponse.json(
        { error: messageValidation.error || 'Invalid message' },
        { status: 400 }
      );
    }

    const sanitizedMessage = messageValidation.sanitized!;

    // Validate currentPolyhouses if provided
    if (currentPolyhouses && !Array.isArray(currentPolyhouses)) {
      return NextResponse.json(
        { error: 'Invalid currentPolyhouses format' },
        { status: 400 }
      );
    }

    // Limit chat history size
    const limitedChatHistory = Array.isArray(chatHistory) 
      ? chatHistory.slice(-10) // Last 10 messages only
      : [];

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // Fallback to pattern matching if no API key
      return NextResponse.json(parseWithPatternMatching(sanitizedMessage, currentPolyhouses || []));
    }

    // Use OpenAI to parse the request
    const parsed = await parseWithLLM(sanitizedMessage, currentPolyhouses || [], limitedChatHistory, openaiApiKey);
    
    // Validate parsed rules
    if (parsed.rules && Array.isArray(parsed.rules)) {
      parsed.rules = parsed.rules.filter((rule: any) => validateRuleData(rule));
    }
    
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error parsing chat message:', error);
    return NextResponse.json(
      { 
        isValid: false,
        isPolyhouseRelated: true,
        needsClarification: false,
        error: 'Failed to parse request. Please try rephrasing.',
      },
      { status: 500 }
    );
  }
}

/**
 * Parse using OpenAI LLM
 */
async function parseWithLLM(
  message: string,
  currentPolyhouses: any[],
  chatHistory: any[],
  apiKey: string
): Promise<any> {
  const systemPrompt = `You are a polyhouse planning assistant. Parse user requests into structured rules for modifying polyhouse layouts.

Available polyhouses: ${JSON.stringify(currentPolyhouses.map(ph => ({ id: ph.id, name: ph.name })))}

Rule types:
1. constraint - Modify constraints (max_dimension_m, min_dimension_m, gutter_border_m, orientation)
2. exclusion - Exclude areas (water bodies, specific polyhouses, custom areas)
3. modification - Modify behavior (spacing, block size)

Return JSON with:
{
  "isValid": boolean,
  "isPolyhouseRelated": boolean,
  "needsClarification": boolean,
  "clarificationQuestions": string[] (if needsClarification is true),
  "rules": [{
    "rule_type": "constraint" | "exclusion" | "modification",
    "rule_action": string (e.g., "exclude_water", "remove_polyhouse", "set_max_dimension"),
    "rule_data": object (parameters for the rule)
  }]
}

If the request is not about polyhouses, set isPolyhouseRelated to false.
If information is missing (location, size, ID), set needsClarification to true and provide questions.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cheaper model for parsing
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to pattern matching
    return parseWithPatternMatching(message, currentPolyhouses);
  }
}

/**
 * Fallback pattern matching parser
 */
function parseWithPatternMatching(
  message: string,
  currentPolyhouses: any[]
): any {
  const lowerMessage = message.toLowerCase();
  const rules: any[] = [];
  let needsClarification = false;
  const clarificationQuestions: string[] = [];

  // Pattern: "remove polyhouse X" or "delete polyhouse X"
  const removeMatch = lowerMessage.match(/(?:remove|delete|exclude)\s+(?:polyhouse\s+)?([A-Z])/i);
  if (removeMatch) {
    const polyhouseId = removeMatch[1];
    rules.push({
      rule_type: 'exclusion',
      rule_action: 'exclude_polyhouse',
      rule_data: { polyhouse_id: polyhouseId },
    });
  } else if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
    needsClarification = true;
    clarificationQuestions.push('Which polyhouse do you want to remove? (e.g., "A", "B", "C")');
  }

  // Pattern: water body mentions
  if (lowerMessage.includes('water') || lowerMessage.includes('pond') || lowerMessage.includes('lake')) {
    // Check if size and location are mentioned
    const hasSize = /\d+\s*m/i.test(message);
    const hasLocation = /(?:middle|center|north|south|east|west|location)/i.test(message);
    
    if (hasSize && hasLocation) {
      // Extract approximate bounds (simplified - would need more parsing)
      rules.push({
        rule_type: 'exclusion',
        rule_action: 'exclude_water',
        rule_data: {
          description: 'User-specified water body',
          // Note: bounds would need to be calculated from user description
          // For now, this is a placeholder
        },
      });
    } else {
      needsClarification = true;
      if (!hasSize) {
        clarificationQuestions.push('What is the approximate size of the water body? (e.g., "10m x 20m")');
      }
      if (!hasLocation) {
        clarificationQuestions.push('Where is the water body located? (e.g., "in the middle", "north side")');
      }
    }
  }

  // Pattern: orientation changes
  if (lowerMessage.includes('orientation') || lowerMessage.includes('angle')) {
    const angleMatch = message.match(/(\d+)\s*degree/i);
    if (angleMatch) {
      rules.push({
        rule_type: 'constraint',
        rule_action: 'set_orientation',
        rule_data: { angle: parseInt(angleMatch[1]) },
      });
    } else {
      needsClarification = true;
      clarificationQuestions.push('What orientation do you want? (e.g., "90 degrees", "North-South")');
    }
  }

  return {
    isValid: rules.length > 0 || needsClarification,
    isPolyhouseRelated: true,
    needsClarification,
    clarificationQuestions: needsClarification ? clarificationQuestions : undefined,
    rules: rules.length > 0 ? rules : undefined,
  };
}
