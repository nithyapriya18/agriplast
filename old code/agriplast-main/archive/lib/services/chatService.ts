import { getSql, type ChatMessage, type PolygonRule } from '@/lib/db';

/**
 * Save a chat message to the database
 */
export async function saveChatMessage(
  polygonId: string,
  versionId: string | null,
  role: 'user' | 'system' | 'clarification',
  message: string,
  metadata?: any
): Promise<ChatMessage | null> {
  if (!process.env.DATABASE_URL) {
    console.warn('Database not configured. Chat message not saved.');
    return null;
  }

  try {
    const sql = getSql();
    if (!sql) return null;
    
    const result = await sql`
      INSERT INTO chat_history (
        polygon_id,
        version_id,
        role,
        message,
        metadata
      )
      VALUES (
        ${polygonId},
        ${versionId || null},
        ${role},
        ${message},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb
      )
      RETURNING *
    `;

    if (result && result.length > 0) {
      return result[0] as ChatMessage;
    }

    return null;
  } catch (error) {
    console.error('Error saving chat message:', error);
    return null;
  }
}

/**
 * Get all chat messages for a polygon
 */
export async function getChatHistory(polygonId: string): Promise<ChatMessage[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const sql = getSql();
    if (!sql) return [];
    
    const result = await sql`
      SELECT *
      FROM chat_history
      WHERE polygon_id = ${polygonId}
      ORDER BY created_at ASC
    `;

    return (result || []) as ChatMessage[];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

/**
 * Get chat history for a specific version
 */
export async function getVersionChatHistory(versionId: string): Promise<ChatMessage[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const sql = getSql();
    if (!sql) return [];
    
    const result = await sql`
      SELECT *
      FROM chat_history
      WHERE version_id = ${versionId}
      ORDER BY created_at ASC
    `;

    return (result || []) as ChatMessage[];
  } catch (error) {
    console.error('Error fetching version chat history:', error);
    return [];
  }
}

/**
 * Save a polygon rule
 */
export async function savePolygonRule(
  versionId: string,
  ruleType: 'constraint' | 'exclusion' | 'modification',
  ruleAction: string,
  ruleData: any
): Promise<PolygonRule | null> {
  if (!process.env.DATABASE_URL) {
    console.warn('Database not configured. Rule not saved.');
    return null;
  }

  try {
    const sql = getSql();
    if (!sql) return null;
    
    const result = await sql`
      INSERT INTO polygon_rules (
        version_id,
        rule_type,
        rule_action,
        rule_data
      )
      VALUES (
        ${versionId},
        ${ruleType},
        ${ruleAction},
        ${JSON.stringify(ruleData)}::jsonb
      )
      RETURNING *
    `;

    if (result && result.length > 0) {
      return result[0] as PolygonRule;
    }

    return null;
  } catch (error) {
    console.error('Error saving polygon rule:', error);
    return null;
  }
}

/**
 * Get all rules for a version (including inherited from parent versions)
 */
export async function getVersionRules(versionId: string): Promise<PolygonRule[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const sql = getSql();
    if (!sql) return [];
    
    const result = await sql`
      SELECT * FROM get_version_rules(${versionId})
    `;

    // The function returns rule_type, rule_action, rule_data
    // We need to fetch the full rule records
    const ruleData = result || [];
    
    // Get full rule records
    const fullRules = await sql`
      SELECT pr.*
      FROM polygon_rules pr
      WHERE pr.version_id IN (
        WITH RECURSIVE version_tree AS (
          SELECT id, parent_version_id, 0 as depth
          FROM saved_polygons
          WHERE id = ${versionId}
          
          UNION ALL
          
          SELECT sp.id, sp.parent_version_id, vt.depth + 1
          FROM saved_polygons sp
          INNER JOIN version_tree vt ON sp.id = vt.parent_version_id
          WHERE vt.depth < 100
        )
        SELECT id FROM version_tree
      )
      ORDER BY pr.applied_at ASC
    `;

    return (fullRules || []) as PolygonRule[];
  } catch (error) {
    console.error('Error fetching version rules:', error);
    return [];
  }
}
