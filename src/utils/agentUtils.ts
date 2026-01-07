import { getClient } from './supabaseClient';
import { Request, Response } from 'express';
import { convertUrlToBase64 } from './fileUtils';
import {
  ChatRequest,
  UserModel,
  MCPServer,
  AttachedTool,
  Message,
  FileInput,
  ChatAgent,
  AuthenticatedRequest,
} from '../types';
import { loadAgentThreads } from './threadsUtils';

const agentParseFiles = async (
  userModel: UserModel,
  files: any,
  newMessage: any,
  req: AuthenticatedRequest
): Promise<void> => {
  if (userModel?.model_id?.brand_id?.slug === 'anthropic') {
    files?.map((file: any) => {
      newMessage.content.push({
        type: file?.type?.toLowerCase().includes('image')
          ? 'image'
          : 'document',
        source: { type: 'url', url: file.url },
      });
    });
    return newMessage;
  }

  if (userModel?.model_id?.brand_id?.slug === 'openai') {
    files?.map((file: any) => {
      newMessage.content.push({
        type: file?.type?.toLowerCase().includes('image')
          ? 'input_image'
          : 'input_file',
        [file?.type?.toLowerCase().includes('image')
          ? 'image_url'
          : 'file_url']: file.url,
      });
    });
    return newMessage;
  }

  if (userModel?.model_id?.config?.api === 'chat') {
    if (userModel?.model_id?.brand_id?.slug === 'google') {
      newMessage = await parseFiles(req, newMessage);
    } else {
      files?.map((file: any) => {
        newMessage.content.push({
          type: file?.type?.toLowerCase().includes('image')
            ? 'image_url'
            : 'input_file',
          [file?.type?.toLowerCase().includes('image')
            ? 'image_url'
            : 'file_url']: { url: file.url },
        });
      });
    }
    return newMessage;
  }
  return newMessage;
};

export const createChatAgent = async (
  req: ChatRequest,
  res: Response
): Promise<ChatAgent> => {
  const { userModel } = (req as AuthenticatedRequest).user;

  //openai Responses api uses input_text, anthropic and openai chat completions use text
  const contentType =
    userModel?.model_id?.brand_id?.slug === 'openai' ? 'input_text' : 'text';
  const files = req.body.files || [];
  let newMessage: any = {
    role: 'user',
    content: [{ type: contentType, text: req.body.prompt }],
  };

  const chatAgent: ChatAgent = {
    currentMessage: [],
    usage: [],
    threadId: null,
    payload: null,
    api: null,
    apiKey:
      (typeof userModel?.apikey === 'object'
        ? userModel?.apikey?.key
        : userModel?.apikey) || null,
    res: res,
    req: req as any,
    mcpServers: [],
  };

  const { allThreadMessages = [], threadId = null } = await loadAgentThreads(
    req.body.thread_id || null,
    req as AuthenticatedRequest
  );
  chatAgent.threadId = threadId;

  newMessage = await agentParseFiles(
    userModel,
    files,
    newMessage,
    req as AuthenticatedRequest
  );
  //use to track just this message between user and agent
  chatAgent.currentMessage.push(newMessage);
  allThreadMessages.push(newMessage);
  //chatAgent.payload = await createPayload(req as AuthenticatedRequest);
  //use to track all messages between user and agent, contents has
  if (userModel?.model_id?.brand_id?.slug === 'openai') {
    chatAgent.payload = { input: allThreadMessages };
  } else {
    chatAgent.payload = { messages: allThreadMessages };
  }
  return chatAgent;
};

export const getAgentMCPServers = async (
  mcpServers: string[],
  req: AuthenticatedRequest
): Promise<MCPServer[]> => {
  const { supabase } = await getClient();

  // If no MCP server IDs provided, return empty array
  if (!mcpServers || mcpServers.length === 0) {
    return [];
  }

  // Fetch MCP servers by the provided IDs
  const { data, error } = await supabase
    .from('user_mcp_servers')
    .select('*')
    .in('id', mcpServers);

  if (error) {
    console.error('Error fetching agent MCP servers:', error);
    return [];
  }

  //if req.user.userProfile.balance is less than or equal to 0, and getMcpServers has any server with has_sloot_tool true, throw an error
  if (
    req.user.userProfile.balance <= 0 &&
    data &&
    data.length > 0 &&
    data.some((server: any) => server.has_sloot_tool)
  ) {
    const error = new Error(
      'Insufficient funds to use Sloot tools. Please add funds to your account.'
    );
    (error as any).error = 'Insufficient Funds';
    (error as any).message =
      'Insufficient funds to use Sloot tools. Please add funds to your account.';
    throw error;
  }

  return data || [];
};

export const optionalFields = (payload: any, model: UserModel): any => {
  if (model.settings.optionalFields) {
    model.settings.optionalFields.forEach(field => {
      if (field.json_payload) {
        const newPayloadJson = JSON.parse(field.json_payload);
        payload = {
          ...payload,
          ...newPayloadJson,
        };
      } else {
        payload = {
          ...payload,
          ...field,
        };
      }
    });
  }
  return payload;
};

// Load attached tools for this agent
export const getAttachedTools = async (
  agentId: string
): Promise<AttachedTool[]> => {
  const { supabase } = await getClient();
  const { data, error } = await supabase
    .from('user_model_tools')
    .select(
      `id,user_model_id,user_tool_id,created_at,tool:user_tools!inner(id,tool_name,schema,avatar,is_admin,is_pipedream,is_sloot)`
    )
    .eq('user_model_id', agentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching agent tools:', error);
    return [];
  }
  return data || [];
};

export const parseFiles = async (
  req: ChatRequest,
  newMessage: Message
): Promise<Message> => {
  // Process files if they exist
  if (req.body?.files) {
    await Promise.all(
      req.body.files.map(async (file: FileInput) => {
        if (
          file.url &&
          (file.url.startsWith('http') || file.url.startsWith('https'))
        ) {
          const base64Data = await convertUrlToBase64(file.type, file.url);
          newMessage.content.push({
            type: file?.type?.toLowerCase().includes('image')
              ? 'image_url'
              : 'input_file',
            [file?.type?.toLowerCase().includes('image')
              ? 'image_url'
              : 'file_url']: { url: `data:${file.type};base64,${base64Data}` },
          } as any);
        }
      })
    );
  }
  return newMessage;
};

export const parseJson = (
  jsonString: string
): { success: boolean; data: any } => {
  try {
    // Check if the string is not empty and can be parsed as JSON
    if (
      jsonString &&
      typeof jsonString === 'string' &&
      jsonString.trim() !== ''
    ) {
      const parsedData = JSON.parse(jsonString);
      return { success: true, data: parsedData };
    } else {
      // If string is empty or not a string, return the original string
      return { success: false, data: jsonString };
    }
  } catch (error) {
    // If JSON parsing fails, return the original string
    return { success: false, data: jsonString };
  }
};
