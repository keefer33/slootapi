import { getClient } from './supabaseClient'
import { randomBytes } from 'crypto'
import { createUserPollingFile, createPollingTask } from '../controllers/pollingFIleController';
import { runPipedreamAction } from '../controllers/pipedreamController';
import { getCurrentUser } from './userUtils';
import { getFileExtension } from './fileUtils';

// Generate a shorter unique ID (8 characters)
const generateShortId = (): string => {
  return randomBytes(6).toString('base64url');
};

// Type definitions
export interface ToolResponse {
  success?: boolean;
  error?: string;
  message?: string;
  result?: any;
  usage?: any;
}

export interface ToolData {
  id: string;
  schema: any;
  user_id: string;
  is_pipedream: boolean;
  pipedream?: any;
  is_sloot: boolean;
  sloot?: {
    id?: string;
    api?: string;
    type?: string;
    brand?: string;
    config?: any;
    pricing: any;
    category?: string;
    poll?: string;
  } | null;
  user_connect_api?: {
    api_url?: string;
    auth_token?: string;
  } | null;
}

export interface FinalResponse {
  result: any;
  usage: any[] | null;
}

export interface SlootToolResponse {
  result: any;
  usage: any[];
}

export interface FileMetadata {
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  public_url: string;
}

export const callTool = async (
  toolData: ToolData | { error: string },
  completedArgs: any,
  userId: string
): Promise<FinalResponse> => {
  const finalResponse: FinalResponse = { result: null, usage: null };
  try {
    if ('error' in toolData) {
      finalResponse.result = { error: toolData.error };
      return finalResponse;
    }

    if (toolData?.is_pipedream) {
      const action = await runPipedreamAction(
        userId,
        toolData.id,
        toolData.schema.name,
        toolData.pipedream.id,
        toolData.pipedream.appType.name,
        completedArgs
      );

      return action;
    } else {
      let executionTime = 0;
      const startTime = Date.now();
      delete completedArgs.tool_id;

      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (toolData.user_connect_api!.auth_token) {
        if (toolData.user_connect_api!.auth_token === 'sloot-internal') {
          headers['Authorization'] = `Bearer ${getCurrentUser()?.token || ''}`;
        } else {
          headers['Authorization'] =
            `Bearer ${toolData.user_connect_api!.auth_token}`;
        }
      }
      console.log('headers', headers);
      console.log('completedArgs', completedArgs);
      console.log(
        'toolData.user_connect_api!.api_url',
        toolData.user_connect_api!.api_url
      );
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
      const apiCall = await fetch(toolData.user_connect_api?.api_url || '', {
        method: 'POST',
        body: JSON.stringify(completedArgs),
        headers: headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!apiCall.ok) {
        const errorData = (await apiCall.json()) as any;
        console.log('errorData', errorData);
        throw new Error(errorData.error || 'Failed to call tool');
      }
      executionTime = Date.now() - startTime;
      const response = await apiCall.json();
      //process sloot tool
      if (toolData?.is_sloot) {
        const result = await callSlootTool(toolData, response, userId, completedArgs);
        if (result !== null) {
          finalResponse.result = result.result;
          finalResponse.usage = result.usage;
        }
      } else {
        finalResponse.result = response;
        finalResponse.usage = null;
      }
      await saveToolRun(
        userId,
        toolData.id,
        completedArgs,
        finalResponse,
        executionTime
      );
      return finalResponse;
    }
  } catch (error: any) {
    //console.log('error', error);
    console.error('Error executing tool:', error.message);

    // Handle specific timeout errors
    if (error.name === 'AbortError') {
      finalResponse.result = {
        error: 'Request timeout - the operation took too long to complete',
      };
    } else {
      finalResponse.result = { error: error.message };
    }

    //need to throw an error
    throw new Error(finalResponse.result.error);
    //return finalResponse;
  }
};

const callSlootTool = async (
  toolData: ToolData,
  response: any,
  userId: string,
  completedArgs: any
): Promise<SlootToolResponse | null> => {

  const finalResponse: SlootToolResponse = { result: {}, usage: [] };
  switch (toolData?.sloot?.api) {
    case 'images/generations': {
      const iterator = response?.images ? response?.images : response?.data;
      if (iterator) {
        await Promise.all(
          iterator.map(async (image: any, index: number) => {
            const result = await saveFileFromUrl(image?.url, userId, toolData);
            iterator[index].url = result;
            finalResponse.usage.push({
              type: 'tool',
              toolName: toolData.schema.name || 'Unknown',
              brand: toolData.sloot!.brand || 'Unknown',
              toolId: toolData.id || 'Unknown',
              output: {
                type: 'image_url',
                content: result,
              },
              total_cost: toolData.sloot!.pricing.amount || 0,
            });
          })
        );
      }
      finalResponse.result = response;
      const cost = calculatePricing(toolData);
      await saveSlootToolUsage(userId, response, toolData, cost);
      return finalResponse;
    }
    case 'video/generate': {
      const config = {
        response: response,
        toolData: toolData,
      };
      let pollingFileId = null;

        console.log('response', response);
        pollingFileId = await createUserPollingFile(config as any, userId, completedArgs);
        console.log('pollingFileId', pollingFileId);
        finalResponse.result = response;
        finalResponse.result.pollingFileId = pollingFileId?.data.id || null;
        finalResponse.result.message = 'Your video is being generated';
        finalResponse.usage.push({
          type: 'tool',
          toolName: toolData.schema.name || 'Unknown',
          brand: toolData.sloot!.brand || 'Unknown',
          toolId: toolData.id || 'Unknown',
          output: {
            type: 'video_url',
            content: pollingFileId?.data.id || null,
          },
          total_cost: toolData.sloot!.pricing.amount || 0,
        });

      //.result = response;
      return finalResponse;
    }
    case 'image/url': {
      const imageUrl = await saveFileFromUrl(
        response?.image_url,
        userId,
        toolData
      );
      finalResponse.result = imageUrl;
      //finalResponse.result.image_url = imageUrl;
      finalResponse.usage.push({
        type: 'tool',
        toolName: toolData.schema.name || 'Unknown',
        brand: toolData.sloot!.brand || 'Unknown',
        output: {
          type: 'image_url',
          content: imageUrl,
        },
        total_cost: toolData.sloot!.pricing.amount || 0,
        toolId: toolData.id || 'Unknown',
      });
      const cost = calculatePricing(toolData);
      await saveSlootToolUsage(userId, response, toolData, cost);
      return finalResponse;
    }
    case 'aiml/generate/video':
      console.log('response', response);
      return await createPollingTask(toolData, response, userId, response.id, finalResponse) as SlootToolResponse;
    case 'kie/createTask': {
      if ( response.code !== 200) {
        throw new Error(response.msg);
      }
      return await createPollingTask(toolData, response, userId, response.data.taskId, finalResponse) as SlootToolResponse;
    }
    default:
      finalResponse.result = response;
      const cost = calculatePricing(toolData);
      await saveSlootToolUsage(userId, response, toolData, cost);
      return finalResponse;
  }
};

export const saveFileFromUrl = async (
  url: string,
  userId: string,
  toolData: ToolData
): Promise<string | null> => {
  const { supabase } = await getClient();
  try {
    // Fetch the file from the URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`
      );
    }

    // Get the file blob
    const blob = await response.blob();

    // Determine file name from URL or use provided name

    const fileExt = getFileExtension(url);
    console.log('fileExt', fileExt);

    // Generate a shorter unique ID for the file name
    const uniqueId = generateShortId();
    const finalFileName = `${toolData?.sloot?.id || 'tool'}-${uniqueId}.${fileExt}`;
    const filePath = `${userId}/${finalFileName}`;

    // Create a Buffer from the blob for Node.js compatibility
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the actual file to Supabase storage
    const { error } = await supabase.storage
      .from('user-files')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: blob.type || 'application/octet-stream',
      });

    if (error) {
      console.error('Error uploading file to Supabase storage:', error);
      throw new Error(
        `Failed to upload file to Supabase storage: ${error.message}`
      );
    }

    // Get the public URL
    const { data: urlData } = await supabase.storage
      .from('user-files')
      .getPublicUrl(filePath);

    // Save file metadata to database
    const fileMetadata: FileMetadata = {
      user_id: userId,
      file_name: finalFileName,
      file_path: filePath,
      file_size: blob.size,
      file_type: blob.type || 'application/octet-stream',
      public_url: urlData.publicUrl,
    };

    const { error: dbError } = await supabase
      .from('user_files')
      .insert(fileMetadata);

    if (dbError) {
      throw new Error(
        `Failed to save file metadata to database: ${dbError.message}`
      );
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Error downloading file from URL:', error);
    throw new Error(
      `Failed to download file from URL: ${error.message}`
    );
  }
};

export const saveToolRun = async (
  userId: string,
  toolId: string,
  completedArgs: any,
  finalResponse: FinalResponse,
  executionTime: number
) => {
  const { supabase } = await getClient();
  const { error } = await supabase.from('user_tools_runs').insert({
    user_id: userId,
    tool_id: toolId,
    payload: completedArgs,
    response: finalResponse,
    status: 'success',
    error_message: null,
    execution_time_ms: executionTime,
  });
  if (error) {
    console.error('Error saving tool run:', error);
  }
};

export const calculatePricing = (toolData: ToolData, response?: any) => {
  // Calculate pricing based on number of files
  const resultJson = JSON.parse(response?.data?.resultJson || '{}');
  const params = JSON.parse(response?.data?.param || '{}');
  console.log('params', params);
  const pricing = toolData.sloot?.pricing;
  let totalCost = 0;
  let numFiles = 0;

  if (pricing) {
    const { type, amount } = pricing;

    switch (type) {
      case 'perMulti':
        // Calculate number of files for pricing
      if (resultJson.resultUrls && Array.isArray(resultJson.resultUrls)) {
          numFiles = resultJson.resultUrls.length;
      } else if (resultJson.resultUrls && typeof resultJson.resultUrls === 'string') {
          numFiles = 1;
      }
          totalCost = (amount || 0) * (numFiles || 1);
        break;
      case 'durationResolution':
        totalCost = (amount[params?.input?.resolution] || 0) * (Number(params?.input?.duration || 0));
        break;
      case 'per':
        totalCost = amount || 0;
        break;
      default:
        totalCost = amount || 0;
        break;
    }
  }
  return totalCost;
}

export const saveSlootToolUsage = async (
  userId: string,
  response: any,
  toolData: ToolData,
  cost?: number
) => {
  const { supabase } = await getClient();

  //save sloot tool usage with calculated cost
  const { data, error } = await supabase.from('user_usage').insert({
    user_id: userId,
    usage_summary: response,
    type: 'tool',
    input_tokens: 0,
    output_tokens: 0,
    total_cost: cost || 0,
    brand: toolData.sloot!.brand || 'unknown',
    model: toolData.schema.name || 'unknown',
  });

  if (error) {
    console.error('Error saving sloot tool usage with files:', error);
  }
  return data;
};
