import {
  AnthropicTool,
  BasePayload,
  ChatAgent,
  ChatRequest,
  ConfiguredMCPServer,
  UserModel,
} from '../../types';
import {
  MCPServer,
  ToolCall,
  ToolInfo,
  ToolCallResult,
  AnthropicPayload,
} from '../../types';
import { getUserTool } from '../toolsController';
import { callTool } from '../../utils/runToolUtils';
import { ToolCallResponse } from '../../types';
import {
  getAgentMCPServers,
  getAttachedTools,
  optionalFields,
  parseJson,
} from '../../utils/agentUtils';
import { MCPCall } from '../../types';
import { getPipedreamClient } from '../../utils/pipedreamClient';

const getToolInfo = (toolCall: ToolCall, payload: any): ToolInfo => {
  const tool = payload.tools.find((fd: any) => fd.name === toolCall.name);
  const toolId = tool.input_schema.properties.tool_id.enum[0];
  const schema = tool.input_schema;
  return { toolId, schema };
};

export const handleToolCall = async (
  toolCalls: ToolCall[],
  chatAgent: ChatAgent
): Promise<ChatAgent> => {
  const output_items: ToolCallResult[] = [];
  await Promise.all(
    toolCalls.map(async toolCall => {
      const { toolId, schema } = getToolInfo(toolCall, chatAgent.payload);
      const result = await callAnthropicTool(
        toolCall,
        toolId,
        schema,
        chatAgent,
        chatAgent.req.user.userId
      );
      output_items.push(result.toolCallResult);
      if (result.usage) {
        chatAgent.usage = [...chatAgent.usage, ...result.usage];
      }
      return result.toolCallResult;
    })
  );
  chatAgent.currentMessage.push({ role: 'user', content: output_items });
  return chatAgent;
};

// Shared function to call tools
export const callAnthropicTool = async (
  toolCall: ToolCall,
  toolId: string,
  schema: any,
  chatAgent: ChatAgent,
  userId: string
): Promise<ToolCallResponse> => {
  const args = toolCall.input;
  const requiredArgs: any = {};
  schema?.required?.forEach((arg: string) => {
    //return the arg and the default value if the arg is not in the args
    if (!args[arg]) {
      requiredArgs[arg] = schema?.properties[arg]?.default;
    }
  });
  const completedArgs = { ...args, ...requiredArgs };

  const tool = await getUserTool(toolId, userId);
  if ('error' in tool) {
    return {
      toolCallResult: {
        type: 'function_call_output',
        call_id: toolCall.call_id || undefined,
        output: JSON.stringify({ error: tool.error }),
      },
      usage: null,
    };
  }

  const result = await callTool(tool, completedArgs, chatAgent.req.user.userId);

  const toolCallResult: ToolCallResult = {
    tool_use_id: toolCall.id || undefined,
    type: 'tool_result',
    content:
      typeof result.result === 'object'
        ? JSON.stringify(result.result)
        : result.result,
  };
  return { toolCallResult, usage: result?.usage || null };
};

export const handleMCPCall = async (
  content: any[],
  chatAgent: ChatAgent
): Promise<ChatAgent> => {
  const mcpCalls = content.filter(
    (output: any) => output.type === 'mcp_tool_result'
  );
  try {
    if (mcpCalls?.length && mcpCalls.length > 0) {
      mcpCalls.map(async (mcpCall: MCPCall) => {
        const mcpCallOutput = parseJson(mcpCall.content?.[0]?.text || '');
        if (mcpCallOutput.success) {
          mcpCallOutput.data?.usage &&
            chatAgent.usage.push(...mcpCallOutput.data.usage);
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return chatAgent;
};

export const createPayload = async (req: ChatRequest) => {
  let payload: BasePayload = {};
  let mcpServers: ConfiguredMCPServer[] = [];
  let getPipedreamMcpServers: ConfiguredMCPServer[] = [];
  let allMcpServers: ConfiguredMCPServer[] = [];
  const model = req.user.userModel;

  //check if agent config has mcp servers
  if (model.settings?.mcp_servers && model.settings.mcp_servers.length > 0) {
    //get custom mcp servers
    const getMcpServers = await getAgentMCPServers(model.settings?.mcp_servers, req);

    const getConfigMcpServers = await configureMCPServers(
      getMcpServers,
      model,
      req
    );
    mcpServers = getConfigMcpServers;
  }
  //get pipedream mcp servers
  if (model?.settings?.pipedream && model.settings.pipedream.length > 0) {
    const getPipedreamMcpServers = await configurePipedreamMCPServers(
      model,
      req
    );
  }

  allMcpServers = [...mcpServers, ...getPipedreamMcpServers];

  const anthropicTools = (await configureAnthropicTools(
    model
  )) as AnthropicTool[];
  payload = await agentAnthropicPayload(model, allMcpServers, anthropicTools);
  return payload;
};

export const configureMCPServers = async (
  getMcpServers: MCPServer[],
  model: UserModel,
  req: ChatRequest
): Promise<ConfiguredMCPServer[]> => {
  const mcpServers: ConfiguredMCPServer[] = [];

  getMcpServers.forEach(server => {
    const mcpServer: ConfiguredMCPServer = {
      type: 'url',
      url: server.server_url,
      name: server.server_name,
    };

    if (server.type === 'connect' && server.auth_token) {
      mcpServer.authorization_token = server.auth_token;
    } else if (server.type === 'public' || server.type === 'private') {
      mcpServer.authorization_token = req.user.token;
    }
    mcpServers.push(mcpServer);
  });

  return mcpServers;
};

const configurePipedreamMCPServers = async (
  model: UserModel,
  req: ChatRequest
): Promise<ConfiguredMCPServer[]> => {
  const pipedreamServers: ConfiguredMCPServer[] = [];

  // Use Promise.all to wait for all async operations
  await Promise.all(
    model.settings?.pipedream?.map(async tool => {
      const pd = getPipedreamClient();
      const accessToken = await pd.rawAccessToken;
      const serverUrl = `https://remote.mcp.pipedream.net?projectId=${process.env.PIPEDREAM_PROJECT_ID}&environment=${process.env.PIPEDREAM_ENVIRONMENT}&externalUserId=${req.user.userId}&app=${tool.name}`;
      pipedreamServers.push({
        type: 'url',
        url: serverUrl,
        name: tool.name,
        authorization_token: accessToken,
      });
    }) || []
  );

  return pipedreamServers;
};

export const agentAnthropicPayload = async (
  model: UserModel,
  mcpServers: ConfiguredMCPServer[],
  tools: AnthropicTool[]
): Promise<AnthropicPayload> => {
  let payload: AnthropicPayload = {
    messages: [],
    ...model.settings.config,
    tools: [],
  };

  if (tools.length > 0) {
    payload.tools = tools;
  }

  if (model.settings?.builtInTools?.web_search_parameters?.enabled) {
    const webSearchParams = {
      ...model.settings.builtInTools.web_search_parameters,
    };
    delete (webSearchParams as any).enabled;
    const webSearchTool: any = {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: webSearchParams.max_uses || 5,
    };

    // Only add allowed_domains if present and not empty
    if (
      webSearchParams.allowed_domains &&
      webSearchParams.allowed_domains.length > 0
    ) {
      webSearchTool.allowed_domains = webSearchParams.allowed_domains;
    }

    // Only add blocked_domains if present and not empty
    if (
      webSearchParams.blocked_domains &&
      webSearchParams.blocked_domains.length > 0
    ) {
      webSearchTool.blocked_domains = webSearchParams.blocked_domains;
    }

    // Only add user_location fields if they have values
    if (webSearchParams.user_location) {
      const userLocation: any = { type: 'approximate' };
      let hasLocationData = false;

      if (webSearchParams.user_location.city) {
        userLocation.city = webSearchParams.user_location.city;
        hasLocationData = true;
      }
      if (webSearchParams.user_location.region) {
        userLocation.region = webSearchParams.user_location.region;
        hasLocationData = true;
      }
      if (webSearchParams.user_location.country) {
        userLocation.country = webSearchParams.user_location.country;
        hasLocationData = true;
      }
      if (webSearchParams.user_location.timezone) {
        userLocation.timezone = webSearchParams.user_location.timezone;
        hasLocationData = true;
      }

      // Only add user_location if we have at least one field with a value
      if (hasLocationData) {
        webSearchTool.user_location = userLocation;
      }
      if (payload.tools) {
        payload.tools.push(webSearchTool);
      }
    }
  }

  if (mcpServers.length > 0) {
    payload.mcp_servers = mcpServers;
    payload.betas = ['mcp-client-2025-04-04'];
  }

  payload = optionalFields(payload, model);
  return payload;
};

export const configureAnthropicTools = async (
  model: UserModel
): Promise<any[]> => {
  const tools: any[] = [];

  if (model.settings?.tools?.length && model.settings.tools.length > 0) {
    const attachedTools = await getAttachedTools(model.id);
    const toolPromises = attachedTools.map(tool => {
      return {
        name: tool.tool.schema.name,
        description:
          tool.tool.schema?.description || `Tool: ${tool.tool.tool_name}`,
        input_schema: {
          ...tool.tool.schema.inputSchema,
          properties: {
            ...tool.tool.schema.inputSchema.properties,
            tool_id: {
              type: 'string',
              description: 'Internal tool identifier',
              enum: [tool.tool.id],
            },
          },
        },
      } as AnthropicTool;
    });
    tools.push(...toolPromises);
  }

  return tools;
};
