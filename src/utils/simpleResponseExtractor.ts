/**
 * Simple response extractor that uses existing config fields
 */

/**
 * Safely get a nested property from an object using dot notation with array index support
 */
function getNestedProperty(obj: any, path: string): any {
  if (!obj || !path) {return undefined;}

  const keys = path.split('.');
  let current: any = obj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (!key) {
      console.log(`Empty key at step ${i + 1}/${keys.length}`);
      return undefined;
    }

    if (current && typeof current === 'object' && current[key] !== undefined) {
      current = current[key];
      continue;
    }

    // Handle array index notation like "resultUrls.[0]"
    if (key.startsWith('[') && key.endsWith(']')) {
      const index = parseInt(key.slice(1, -1));
      if (Array.isArray(current) && !isNaN(index) && index >= 0 && index < current.length) {
        current = current[index];
        continue;
      }
    }

    // Debug logging (uncomment for debugging)
    // console.log(`Path traversal failed at key "${key}" (step ${i + 1}/${keys.length})`);
    // console.log(`Current object:`, JSON.stringify(current, null, 2));
    // console.log(`Available keys:`, current && typeof current === 'object' ? Object.keys(current) : 'null/undefined');

    return undefined;
  }

  return current;
}

/**
 * Extract ID and status from response using config paths
 */
export function extractFromResponse(response: any, config: any): {
  id?: string;
  status?: string;
  success: boolean;
  error?: string;
} {
  try {
    const result: any = {
      success: true
    };

    // Extract ID using pathToParam
    if (config?.pathToParam) {
      const id = getNestedProperty(response, config.pathToParam);

      if (id !== undefined) {
        result.id = String(id);
      } else {
        return {
          success: false,
          error: `Could not extract ID from path: ${config.pathToParam}`
        };
      }
    }

    // Extract status using pathToStatus
    if (config?.pathToStatus) {
      const status = getNestedProperty(response, config.pathToStatus);
      if (status !== undefined) {
        result.status = String(status);
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Error extracting data: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract file URL from response using config paths with optional JSON parsing
 */
export function extractFileUrl(response: any, config: any): {
  fileUrl?: string;
  success: boolean;
  error?: string;
} {
  try {
    if (!config?.fileUrl) {
      return {
        success: false,
        error: 'No fileUrl path configured'
      };
    }

    let dataToSearch = response;

    // If parseResults is configured, parse JSON first
    if (config?.parseResults) {
      const jsonString = getNestedProperty(response, config.parseResults);
      if (jsonString === undefined) {
        return {
          success: false,
          error: `Could not find JSON string at path: ${config.parseResults}`
        };
      }

      try {
        dataToSearch = JSON.parse(jsonString);
      } catch (parseError) {
        return {
          success: false,
          error: `Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }
    }

    // Extract file URL from the data (original response or parsed JSON)
    const fileUrl = getNestedProperty(dataToSearch, config.fileUrl);
    if (fileUrl === undefined) {
      return {
        success: false,
        error: `Could not extract file URL from path: ${config.fileUrl}`
      };
    }

    return {
      success: true,
      fileUrl: String(fileUrl)
    };
  } catch (error) {
    return {
      success: false,
      error: `Error extracting file URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
