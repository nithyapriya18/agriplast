/**
 * Natural Language Processing Service
 * Parses user chat messages into actionable polyhouse rules
 */

export interface ParsedRequest {
  isValid: boolean;
  isPolyhouseRelated: boolean;
  needsClarification: boolean;
  clarificationQuestions?: string[];
  rules?: Array<{
    rule_type: 'constraint' | 'exclusion' | 'modification';
    rule_action: string;
    rule_data: any;
  }>;
  error?: string;
}

/**
 * Keywords that indicate polyhouse-related requests
 */
const POLYHOUSE_KEYWORDS = [
  'polyhouse', 'polyhouses', 'greenhouse', 'greenhouses',
  'block', 'blocks', 'remove', 'delete', 'exclude',
  'water', 'pond', 'lake', 'river', 'body',
  'orientation', 'angle', 'direction', 'rotate',
  'size', 'dimension', 'length', 'width', 'bigger', 'smaller',
  'spacing', 'gap', 'distance', 'border', 'gutter',
  'area', 'region', 'location', 'middle', 'center', 'north', 'south', 'east', 'west',
  'change', 'modify', 'update', 'adjust', 'set',
];

/**
 * Validate if a message is polyhouse-related
 */
export function validatePolyhouseRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return POLYHOUSE_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Parse user request using LLM
 * This calls an API endpoint that uses OpenAI/Anthropic to parse the request
 */
export async function parseUserRequest(
  message: string,
  currentPolyhouses: any[],
  chatHistory: any[]
): Promise<ParsedRequest> {
  // First, quick validation
  if (!validatePolyhouseRequest(message)) {
    return {
      isValid: false,
      isPolyhouseRelated: false,
      needsClarification: false,
      error: 'This request is not related to polyhouse design. Please only ask about modifying polyhouses, blocks, water bodies, or design constraints.',
    };
  }

  try {
    // Call API endpoint for LLM parsing
    const response = await fetch('/api/chat/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        currentPolyhouses: currentPolyhouses.map(ph => ({
          id: ph.id || ph.polyhouse_id,
          name: ph.polyhouse_name || ph.id,
          bounds: ph.bounds,
        })),
        chatHistory: chatHistory.slice(-10), // Last 10 messages for context
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse request');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error parsing request:', error);
    return {
      isValid: false,
      isPolyhouseRelated: true,
      needsClarification: false,
      error: 'Failed to parse your request. Please try rephrasing it.',
    };
  }
}

/**
 * Generate clarification questions based on missing information
 */
export function generateClarificationQuestions(
  parsedRequest: ParsedRequest,
  message: string
): string[] {
  const questions: string[] = [];
  const lowerMessage = message.toLowerCase();

  // Check for water body mentions
  if (lowerMessage.includes('water') || lowerMessage.includes('pond') || lowerMessage.includes('lake')) {
    if (!lowerMessage.includes('size') && !lowerMessage.includes('meter') && !lowerMessage.includes('m ')) {
      questions.push('What is the approximate size of the water body? (e.g., "10m x 20m" or "about 15 meters wide")');
    }
    if (!lowerMessage.includes('location') && !lowerMessage.includes('middle') && !lowerMessage.includes('center') && 
        !lowerMessage.includes('north') && !lowerMessage.includes('south') && !lowerMessage.includes('east') && !lowerMessage.includes('west')) {
      questions.push('Where is the water body located? (e.g., "in the middle", "north side", "center of the plot")');
    }
  }

  // Check for polyhouse removal
  if (lowerMessage.includes('remove') || lowerMessage.includes('delete') || lowerMessage.includes('exclude')) {
    if (!lowerMessage.match(/polyhouse\s+[A-Z]/i) && !lowerMessage.match(/[A-Z]\s+polyhouse/i)) {
      questions.push('Which polyhouse do you want to remove? (e.g., "polyhouse A", "B", "C")');
    }
  }

  // Check for orientation changes
  if (lowerMessage.includes('orientation') || lowerMessage.includes('angle') || lowerMessage.includes('direction')) {
    if (!lowerMessage.includes('north') && !lowerMessage.includes('south') && !lowerMessage.includes('east') && 
        !lowerMessage.includes('west') && !lowerMessage.match(/\d+\s*degree/i)) {
      questions.push('What orientation do you want? (e.g., "North-South", "East-West", or "90 degrees")');
    }
  }

  // Check for size changes
  if (lowerMessage.includes('size') || lowerMessage.includes('dimension') || lowerMessage.includes('bigger') || lowerMessage.includes('smaller')) {
    if (!lowerMessage.match(/\d+\s*m/i) && !lowerMessage.match(/\d+\s*meter/i)) {
      questions.push('What size do you want? (e.g., "100m maximum", "16m minimum")');
    }
  }

  return questions;
}
