import { Response } from 'express';
import { getClient } from '../utils/supabaseClient';
import {
  AuthenticatedRequest,
} from '../types';
import { kieaiEndpoint } from '../utils/kieaiApi';
import { ToolData, FinalResponse } from '../utils/runToolUtils';
import { aimlGenerateVideoEndpoint } from '../utils/aimlApi';

export const createPollingTask = async (
  toolData: ToolData,
  response: any,
  userId: string,
  taskId: string,
  finalResponse: FinalResponse,
  //completedArgs: any
) => {
const config = {
  response: response,
  toolId: toolData.id,
};
let pollingFileId = null;

  console.log('response', response);
  pollingFileId = await createUserPollingFile(config as any, userId, taskId);
  finalResponse.result = response;
  finalResponse.result.pollingFileId = pollingFileId?.data.id || null;
  finalResponse.result.message = 'Your task is being generated';

  finalResponse.usage?.push({
    type: 'tool',
    toolName: toolData.schema.name || 'Unknown',
    brand: toolData.sloot!.brand || 'Unknown',
    toolId: toolData.id || 'Unknown',
    output: {
      type: 'polling-file',
      content: pollingFileId?.data.id || null,
    },
    total_cost: "Pending Completion",
  });
  return finalResponse;
};

export const createUserPollingFile = async (
  config: any,
  userId: string,
  taskId?: string | null
): Promise<any> => {
  try {
    const { supabase } = await getClient();

    const { data, error } = await supabase
      .from('user_polling_files')
      .insert({
        user_id: userId,
        config: config,
        file: null,
        status: 'pending',
        task_id: taskId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user polling file:', error);
      return {
        success: false,
        error: 'Failed to create polling file',
      };
    }

    return {
      success: true,
      data: data,
      message: 'Polling file created successfully',
    };
  } catch (error: any) {
    console.error('Error in createUserPollingFile:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const getUserPollingFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_polling_files')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getUserPollingFiles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch polling files',
      });
      return;
    }

    res.json({
      success: true,
      data: data || [],
      message: 'Polling files retrieved successfully',
    });
  } catch (error: any) {
    console.error('Error in getUserPollingFiles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getUserPollingFileById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const message = 'Polling file retrieved successfully';
    const success = true;
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Polling file ID is required',
      });
      return;
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_polling_files')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.userId) // Ensure user can only access their own files
      .single();

    if (error) {
      console.error('Error in getUserPollingFileById:', error);
      res.status(404).json({
        success: false,
        error: 'Polling file not found',
      });
      return;
    }

    res.json({
      success: success,
      data: data,
      message: message,
    });
  } catch (error: any) {
    console.error('Error in getUserPollingFileById:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const supabaseWebhookPollingFile = async (
  req: AuthenticatedRequest,
): Promise<void> => {
  try {
  console.log('req', req.body);
  const { supabase } = await getClient();
  const { data, error } = await supabase
    .from('user_polling_files')
    .select('*')
    .eq('id', req.body.id)
    .single();

  if (error) {
    console.error('Error in getUserPollingFileById:', error);
    throw new Error('Failed to get polling file');
  }

  const { data: toolData, error: toolError } = await supabase
    .from('user_tools')
    .select('*,user_connect_api(*)')
    .eq('id', data.config?.toolId)
    .single();

  if (toolError) {
    console.error('Error in getUserTool:', toolError);
    throw new Error('Failed to get tool data');
  }
console.log('toolData', toolData.sloot?.api);
  switch (toolData.sloot?.api) {
    case 'kie/createTask':
      await kieaiEndpoint(data, toolData);
      break;
    case 'aiml/generate/video':
      await aimlGenerateVideoEndpoint(data, toolData);
      break;
    case 'audio':
      break;
    case 'document':
      break;
    default:
      break;
  }

  } catch (error: any) {
    console.error('Error in supabaseWebhookPollingFile:', error);
    const { supabase } = await getClient();
    await supabase
    .from('user_polling_files')
    .update({
      status: 'error',
      file: null,
      config: {
        callback_data: {
          code: 500,
          msg: error.message,
        },
      },
    })
    .eq('id', req.body.id)
  }
};
