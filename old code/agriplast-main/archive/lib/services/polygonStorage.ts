import { getSql, SavedPolygon } from '@/lib/db';
import html2canvas from 'html2canvas';

export interface PolygonToSave {
  coordinates: Array<{ lat: number; lng: number }>;
  screenshot?: string | null; // Base64 encoded
  polyhouseData?: {
    polyhouses: any[];
    statistics: any;
    unbuildable_regions: any[];
  };
}

/**
 * Capture screenshot of the map
 */
export async function captureMapScreenshot(mapElementId: string = 'google-map-container'): Promise<string | null> {
  try {
    const mapElement = document.getElementById(mapElementId) || document.querySelector('.gm-style')?.parentElement;
    if (!mapElement) {
      console.warn('Map element not found for screenshot');
      return null;
    }

    const canvas = await html2canvas(mapElement as HTMLElement, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#DDF6FF',
      scale: 0.5, // Reduce size for storage
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

/**
 * Get the next polygon ID in format yyyymmdd-n for a user
 * Format: 20260126-0, 20260126-1, etc. (resets daily)
 */
async function getNextPolygonId(userEmail: string): Promise<string> {
  const sql = getSql();
  if (!sql || !process.env.DATABASE_URL) {
    // Fallback: return today's date with -0
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    return `${dateStr}-0`;
  }

  try {
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    const datePrefix = `${dateStr}-`;

    // Get all polygon IDs for this user that start with today's date
    const result = await sql`
      SELECT polygon_number
      FROM saved_polygons 
      WHERE user_email = ${userEmail}
        AND polygon_number LIKE ${datePrefix + '%'}
      ORDER BY polygon_number DESC 
      LIMIT 1
    `;

    if (result && result.length > 0) {
      const lastId = result[0].polygon_number?.toString() || '';
      const parts = lastId.split('-');
      if (parts.length === 2) {
        const lastNum = parseInt(parts[1] || '0', 10);
        return `${dateStr}-${lastNum + 1}`;
      }
    }

    return `${dateStr}-0`;
  } catch (error) {
    console.error('Error getting next polygon ID:', error);
    // Fallback: return today's date with -0
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   String(today.getMonth() + 1).padStart(2, '0') + 
                   String(today.getDate()).padStart(2, '0');
    return `${dateStr}-0`;
  }
}

/**
 * Save a polygon to the database (creates initial version)
 */
export async function savePolygon(
  userEmail: string,
  polygon: PolygonToSave
): Promise<SavedPolygon | null> {
  if (!process.env.DATABASE_URL) {
    console.warn('Database not configured. Polygon not saved.');
    return null;
  }

  try {
    const sql = getSql();
    if (!sql) return null;
    
    const polygonId = await getNextPolygonId(userEmail);
    const screenshot = polygon.screenshot || await captureMapScreenshot();

    const result = await sql`
      INSERT INTO saved_polygons (
        user_email,
        polygon_number,
        polygon_coordinates,
        screenshot_data,
        polyhouse_data,
        version_number,
        is_current_version
      )
      VALUES (
        ${userEmail},
        ${polygonId}, -- Store friendly ID in yyyymmdd-n format
        ${JSON.stringify(polygon.coordinates)}::jsonb,
        ${screenshot || null},
        ${polygon.polyhouseData ? JSON.stringify(polygon.polyhouseData) : null}::jsonb,
        1,
        true
      )
      RETURNING *
    `;

    if (result && result.length > 0) {
      return result[0] as SavedPolygon;
    }

    return null;
  } catch (error) {
    console.error('Error saving polygon:', error);
    return null;
  }
}

/**
 * Create a new version of a polygon with updated rules
 */
export async function createPolygonVersion(
  parentVersionId: string,
  userEmail: string,
  polygon: PolygonToSave,
  versionComment: string,
  rules?: any[] // Optional - rules are now extracted from user_instruction by backend
): Promise<SavedPolygon | null> {
  if (!process.env.DATABASE_URL) {
    console.warn('Database not configured. Version not created.');
    return null;
  }

  try {
    const sql = getSql();
    if (!sql) return null;
    
    // Get parent version to inherit polygon_number
    // CRITICAL: Always validate ownership server-side
    const parentResult = await sql`
      SELECT polygon_number, polygon_coordinates, user_email
      FROM saved_polygons
      WHERE id = ${parentVersionId} AND user_email = ${userEmail}
      LIMIT 1
    `;

    if (!parentResult || parentResult.length === 0) {
      throw new Error('Parent version not found or access denied');
    }
    
    // Additional validation: ensure user_email matches
    if (parentResult[0].user_email !== userEmail) {
      throw new Error('Access denied: polygon ownership mismatch');
    }

    const parent = parentResult[0];
    
    // Mark all previous versions as not current
    await sql`
      UPDATE saved_polygons
      SET is_current_version = false
      WHERE polygon_number = ${parent.polygon_number}
        AND user_email = ${userEmail}
    `;

    // Get next version number
    const versionResult = await sql`
      SELECT MAX(version_number) as max_version
      FROM saved_polygons
      WHERE polygon_number = ${parent.polygon_number}
        AND user_email = ${userEmail}
    `;
    const nextVersion = (versionResult[0]?.max_version || 0) + 1;

    const screenshot = polygon.screenshot || await captureMapScreenshot();

    // Create new version
    const result = await sql`
      INSERT INTO saved_polygons (
        user_email,
        polygon_number,
        polygon_coordinates,
        screenshot_data,
        polyhouse_data,
        version_number,
        parent_version_id,
        is_current_version,
        version_comment
      )
      VALUES (
        ${userEmail},
        ${parent.polygon_number},
        ${JSON.stringify(polygon.coordinates)}::jsonb,
        ${screenshot || null},
        ${polygon.polyhouseData ? JSON.stringify(polygon.polyhouseData) : null}::jsonb,
        ${nextVersion},
        ${parentVersionId},
        true,
        ${versionComment || null}
      )
      RETURNING *
    `;

    if (result && result.length > 0) {
      const newVersion = result[0] as SavedPolygon;

      // Save rules for this version (optional - rules are now extracted from user_instruction by backend)
      if (rules && rules.length > 0) {
        for (const rule of rules) {
          await sql`
            INSERT INTO polygon_rules (
              version_id,
              rule_type,
              rule_action,
              rule_data
            )
            VALUES (
              ${newVersion.id},
              ${rule.rule_type},
              ${rule.rule_action},
              ${JSON.stringify(rule.rule_data)}::jsonb
            )
          `;
        }
      }

      return newVersion;
    }

    return null;
  } catch (error) {
    console.error('Error creating polygon version:', error);
    return null;
  }
}

/**
 * Get all versions of a polygon
 */
export async function getPolygonVersions(
  polygonId: string,
  userEmail: string
): Promise<SavedPolygon[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const sql = getSql();
    if (!sql) return [];
    
    // Get the polygon_number from the given polygon
    const polygonResult = await sql`
      SELECT polygon_number
      FROM saved_polygons
      WHERE id = ${polygonId} AND user_email = ${userEmail}
      LIMIT 1
    `;

    if (!polygonResult || polygonResult.length === 0) {
      return [];
    }

    const polygonNumber = polygonResult[0].polygon_number;

    // Get all versions
    const result = await sql`
      SELECT *
      FROM saved_polygons
      WHERE polygon_number = ${polygonNumber}
        AND user_email = ${userEmail}
      ORDER BY version_number DESC
    `;

    return (result || []) as SavedPolygon[];
  } catch (error) {
    console.error('Error fetching polygon versions:', error);
    return [];
  }
}

/**
 * Get all saved polygons for a user
 */
export async function getSavedPolygons(userEmail: string): Promise<SavedPolygon[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const sql = getSql();
    if (!sql) return [];
    
    const result = await sql`
      SELECT *
      FROM saved_polygons
      WHERE user_email = ${userEmail}
      ORDER BY created_at DESC
    `;

    return (result || []) as SavedPolygon[];
  } catch (error) {
    console.error('Error fetching polygons:', error);
    return [];
  }
}

/**
 * Delete a saved polygon
 */
export async function deletePolygon(polygonId: string, userEmail: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    const sql = getSql();
    if (!sql) return false;
    
    await sql`
      DELETE FROM saved_polygons
      WHERE id = ${polygonId}
        AND user_email = ${userEmail}
    `;

    return true;
  } catch (error) {
    console.error('Error deleting polygon:', error);
    return false;
  }
}

/**
 * Load a saved polygon (returns the polygon data)
 */
export async function loadPolygon(polygonId: string, userEmail: string): Promise<SavedPolygon | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const sql = getSql();
    if (!sql) return null;
    
    const result = await sql`
      SELECT *
      FROM saved_polygons
      WHERE id = ${polygonId}
        AND user_email = ${userEmail}
      LIMIT 1
    `;

    if (result && result.length > 0) {
      return result[0] as SavedPolygon;
    }

    return null;
  } catch (error) {
    console.error('Error loading polygon:', error);
    return null;
  }
}
