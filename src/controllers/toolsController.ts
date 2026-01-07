import { Request, Response } from 'express';
import { getClient } from '../utils/supabaseClient';
import { AuthenticatedRequest } from '../types';
import { callTool } from '../utils/runToolUtils';

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
    type: string;
    brand: string;
    pricing: {
      amount: number;
    };
  };
  user_connect_api?: {
    api_url: string;
    auth_token: string;
  };
}

export interface UserServer {
  id: string;
  server_name: string;
  type: string;
  server_url: string;
  auth_token: string;
}

export const runTool = async (req: Request, res: Response): Promise<void> => {
  try {
    const { toolId, payload } = req.body;
    const tool = await getUserTool(toolId, (req as AuthenticatedRequest).user.userId);
    const result = await callTool(
      tool as any,
      payload,
      (req as AuthenticatedRequest).user.userId
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error running tool:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const loadSlootTools = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { supabase } = await getClient();
  const { data: result, error: resultError } = await supabase
    .from('user_tools')
    .select('id,tool_name,schema,avatar,is_sloot,is_pipedream,pipedream')
    .eq('is_sloot', true)
    .order('created_at', { ascending: false });
  if (resultError) {
    console.error('Error in loadSlootTools:', resultError);
    const errorResponse: ToolResponse = {
      success: false,
      error: resultError.message,
    };
    res.status(500).json(errorResponse);
    return;
  }
  res.status(200).json(result);
};

export const getUserTool = async (
  toolId: string,
  userId: string
): Promise<ToolData | { error: string }> => {
  const { supabase } = await getClient();
  const { data: tool, error: toolError } = await supabase
    .from('user_tools')
    .select(
      'id,schema,user_id,is_pipedream,pipedream,is_sloot,sloot,user_connect_api(*)'
    )
    .eq('id', toolId)
    .single();
  if (toolError) {
    console.error('Error in getUserTool:', toolError);
    return { error: toolError.message };
  }
  if (tool.is_sloot) {
    return tool as ToolData;
  } else {
    if (tool.user_id === userId) {
      return tool as ToolData;
    } else {
      throw new Error('Tool not found');
    }
  }
};

export const getUserServer = async (
  serverId: string
): Promise<UserServer | null> => {
  const { supabase } = await getClient();
  const { data: server, error: serverError } = await supabase
    .from('user_mcp_servers')
    .select('id,server_name,type,server_url,auth_token')
    .eq('id', serverId)
    .single();
  if (serverError) {
    console.error('Error in getUserServer:', serverError);
    return null;
  }
  return server as UserServer;
};
