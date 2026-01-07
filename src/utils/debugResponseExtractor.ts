/**
 * Debug version of response extractor with detailed logging
 */

/**
 * Safely get a nested property from an object using dot notation with array index support
 */
function getNestedProperty(obj: any, path: string): any {
  if (!obj || !path) {return undefined;}

  const keys = path.split('.');
  let current: any = obj;
  
  console.log(`\n=== Path Traversal Debug ===`);
  console.log(`Path: ${path}`);
  console.log(`Keys: [${keys.join(', ')}]`);
  console.log(`Starting object:`, JSON.stringify(obj, null, 2));
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    
    if (!key) {
      console.log(`❌ Empty key at step ${i + 1}/${keys.length}`);
      return undefined;
    }
    
    console.log(`\nStep ${i + 1}: Looking for key "${key}"`);
    console.log(`Current object type:`, typeof current);
    console.log(`Current object:`, JSON.stringify(current, null, 2));
    
    if (current && typeof current === 'object' && current[key] !== undefined) {
      console.log(`✅ Found key "${key}", value:`, current[key]);
      current = current[key];
      continue;
    }
    
    // Handle array index notation like "resultUrls.[0]"
    if (key.startsWith('[') && key.endsWith(']')) {
      const index = parseInt(key.slice(1, -1));
      console.log(`🔍 Checking array index [${index}]`);
      if (Array.isArray(current) && !isNaN(index) && index >= 0 && index < current.length) {
        console.log(`✅ Found array index [${index}], value:`, current[index]);
        current = current[index];
        continue;
      } else {
        console.log(`❌ Array index [${index}] not found or invalid`);
        console.log(`Array length:`, Array.isArray(current) ? current.length : 'not an array');
      }
    }
    
    console.log(`❌ Key "${key}" not found`);
    console.log(`Available keys:`, current && typeof current === 'object' ? Object.keys(current) : 'null/undefined');
    
    return undefined;
  }
  
  console.log(`✅ Final result:`, current);
  return current;
}

/**
 * Extract ID and status from response using config paths (debug version)
 */
export function extractFromResponse(response: any, config: any): {
  id?: string;
  status?: string;
  success: boolean;
  error?: string;
} {
  try {
    console.log('\n=== Response Extraction Debug ===');
    console.log('Response structure:', JSON.stringify(response, null, 2));
    console.log('Config:', JSON.stringify(config, null, 2));

    const result: any = {
      success: true
    };

    // Extract ID using pathToParam
    if (config?.pathToParam) {
      console.log(`\n--- Extracting ID ---`);
      const id = getNestedProperty(response, config.pathToParam);
      
      if (id !== undefined) {
        result.id = String(id);
        console.log(`✅ ID extracted successfully: ${result.id}`);
      } else {
        console.log(`❌ Failed to extract ID from path: ${config.pathToParam}`);
        return {
          success: false,
          error: `Could not extract ID from path: ${config.pathToParam}`
        };
      }
    }

    // Extract status using pathToStatus
    if (config?.pathToStatus) {
      console.log(`\n--- Extracting Status ---`);
      const status = getNestedProperty(response, config.pathToStatus);
      if (status !== undefined) {
        result.status = String(status);
        console.log(`✅ Status extracted successfully: ${result.status}`);
      } else {
        console.log(`❌ Failed to extract status from path: ${config.pathToStatus}`);
      }
    }

    console.log(`\n=== Final Result ===`);
    console.log('Success:', result.success);
    console.log('ID:', result.id);
    console.log('Status:', result.status);

    return result;
  } catch (error) {
    console.log(`❌ Error during extraction:`, error);
    return {
      success: false,
      error: `Error extracting data: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract file URL from response using config paths with optional JSON parsing (debug version)
 */
export function extractFileUrl(response: any, config: any): {
  fileUrl?: string;
  success: boolean;
  error?: string;
} {
  try {
    console.log('\n=== File URL Extraction Debug ===');
    console.log('Response structure:', JSON.stringify(response, null, 2));
    console.log('Config fileUrl:', config?.fileUrl);
    console.log('Config parseResults:', config?.parseResults);

    if (!config?.fileUrl) {
      console.log('❌ No fileUrl path configured');
      return {
        success: false,
        error: 'No fileUrl path configured'
      };
    }

    let dataToSearch = response;

    // If parseResults is configured, parse JSON first
    if (config?.parseResults) {
      console.log(`\n--- Parsing JSON ---`);
      console.log(`Looking for JSON string at path: ${config.parseResults}`);
      const jsonString = getNestedProperty(response, config.parseResults);
      console.log('JSON string found:', jsonString);
      
      if (jsonString === undefined) {
        console.log(`❌ Could not find JSON string at path: ${config.parseResults}`);
        return {
          success: false,
          error: `Could not find JSON string at path: ${config.parseResults}`
        };
      }

      try {
        console.log('Parsing JSON string...');
        dataToSearch = JSON.parse(jsonString);
        console.log('✅ JSON parsed successfully:', JSON.stringify(dataToSearch, null, 2));
      } catch (parseError) {
        console.log(`❌ Failed to parse JSON:`, parseError);
        return {
          success: false,
          error: `Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }
    }

    // Extract file URL from the data (original response or parsed JSON)
    console.log(`\n--- Extracting File URL ---`);
    console.log(`Looking for file URL at path: ${config.fileUrl}`);
    const fileUrl = getNestedProperty(dataToSearch, config.fileUrl);
    console.log('File URL found:', fileUrl);
    
    if (fileUrl === undefined) {
      console.log(`❌ Could not extract file URL from path: ${config.fileUrl}`);
      return {
        success: false,
        error: `Could not extract file URL from path: ${config.fileUrl}`
      };
    }

    console.log(`✅ File URL extracted successfully: ${fileUrl}`);
    return {
      success: true,
      fileUrl: String(fileUrl)
    };
  } catch (error) {
    console.log(`❌ Error extracting file URL:`, error);
    return {
      success: false,
      error: `Error extracting file URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
