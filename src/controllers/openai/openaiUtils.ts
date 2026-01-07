import {
  ChatAgent,
  ToolCall,
  ToolCallResult,
  ToolInfo,
  ToolCallResponse,
  BasePayload,
  MCPServer,
  UserModel,
  ConfiguredMCPServer,
  ChatRequest,
  OpenAITool,
  OpenAIPayload,
} from '../../types';
import {
  getAgentMCPServers,
  optionalFields,
  parseJson,
  getAttachedTools,
} from '../../utils/agentUtils';
import { MCPCall } from '../../types';
import { getUserTool } from '../toolsController';
import { callTool } from '../../utils/runToolUtils';
import { getPipedreamClient } from '../../utils/pipedreamClient';

export const handleToolCall = async (
  toolCalls: ToolCall[],
  chatAgent: ChatAgent
): Promise<ChatAgent> => {
  //call the functions for the tool calls
  const output_items: ToolCallResult[] = [];
  await Promise.all(
    toolCalls.map(async toolCall => {
      const { toolId, schema } = getToolInfo(toolCall, chatAgent.payload);
      const result = await callOpenAITool(toolCall, toolId, schema, chatAgent);
      output_items.push(result.toolCallResult);
      if (result.usage) {
        chatAgent.usage = [...chatAgent.usage, ...result.usage];
      }
      return result.toolCallResult;
    })
  );
  chatAgent.payload.input = output_items;
  chatAgent.currentMessage.push(...output_items);
  return chatAgent;
};

export const getToolInfo = (toolCall: ToolCall, payload: any): ToolInfo => {
  const tool = payload.tools.find((fd: any) => fd.name === toolCall.name);
  const toolId = tool?.parameters?.properties?.tool_id?.enum?.[0] || '';
  const schema = tool.parameters;
  return { toolId, schema };
};

export const callOpenAITool = async (
  toolCall: ToolCall,
  toolId: string,
  schema: any,
  chatAgent: ChatAgent
): Promise<ToolCallResponse> => {
  const args = JSON.parse(toolCall.arguments || '{}');
  const requiredArgs: any = {};
  schema?.required?.forEach((arg: string) => {
    //return the arg and the default value if the arg is not in the args
    if (!args[arg]) {
      requiredArgs[arg] = schema.properties[arg].default;
    }
  });
  const tool = await getUserTool(toolId, chatAgent.req.user.userId);
  if ('error' in tool) {
    return {
      toolCallResult: {
        type: 'function_call_output',
        call_id: toolCall.call_id,
        output: JSON.stringify({ error: tool.error }),
      },
      usage: null,
    };
  }
  const completedArgs = { ...args, ...requiredArgs };
  const result = await callTool(tool, completedArgs, chatAgent.req.user.userId);

  const toolCallResult: ToolCallResult = {
    type: 'function_call_output',
    call_id: toolCall.call_id || undefined,
    output:
      typeof result.result === 'object'
        ? JSON.stringify(result.result)
        : result.result,
  };
  return { toolCallResult, usage: result?.usage || null };
};

export const handleMCPCall = (content: any[], chatAgent: ChatAgent) => {
  const mcpCalls = content.filter((output: any) => output.type === 'mcp_call');
  if (mcpCalls.length > 0) {
    mcpCalls.map(async (mcpCall: MCPCall) => {
      let mcpCallOutput;
      try {
        mcpCallOutput = parseJson(mcpCall.output || '{}');
        if (mcpCallOutput.success) {
          mcpCallOutput.data?.usage &&
            chatAgent.usage.push(...mcpCallOutput.data.usage);
        }
      } catch (error) {
        // If parsing fails, mcpCall.output is not valid JSON, so skip usage check
        console.log(
          'JSON parse error: return from mcp was not valid json, which is expected in some cases',
          error
        );
      }
    });
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
    getPipedreamMcpServers = await configurePipedreamMCPServers(model, req);
  }
  allMcpServers = [...mcpServers, ...getPipedreamMcpServers];
  const openaiTools = (await configureOpenaiTools(model)) as OpenAITool[];
  payload = await agentOpenaiPayload(model, allMcpServers, openaiTools);
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
      type: 'mcp',
      server_url: server.server_url,
      server_label: server.server_name,
      require_approval: 'never',
    };

    if (server.type === 'connect' && server.auth_token) {
      mcpServer.headers = {
        Authorization: `Bearer ${server.auth_token}`,
      };
    } else if (server.type === 'public' || server.type === 'private') {
      mcpServer.headers = {
        Authorization: `Bearer ${req.user.token}`,
      };
    }
    mcpServers.push(mcpServer);
  });

  return mcpServers;
};

export const configurePipedreamMCPServers = async (
  model: UserModel,
  req: ChatRequest
): Promise<ConfiguredMCPServer[]> => {
  const pipedreamServers: ConfiguredMCPServer[] = [];

  // Use Promise.all to wait for all async operations
  await Promise.all(
    model.settings?.pipedream?.map(async tool => {
      const pd = getPipedreamClient();
      const accessToken = await pd.rawAccessToken;
      const newWaySave: ConfiguredMCPServer = {
        type: 'mcp',
        server_label: tool.name,
        server_url: 'https://remote.mcp.pipedream.net',
        require_approval: 'never',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-pd-project-id': process.env.PIPEDREAM_PROJECT_ID!,
          'x-pd-environment': process.env.PIPEDREAM_ENVIRONMENT!,
          'x-pd-external-user-id': req.user.userId,
          'x-pd-app-slug': tool.name,
        },
      };
      pipedreamServers.push(newWaySave);
    }) || []
  );

  return pipedreamServers;
};

export const agentOpenaiPayload = async (
  model: UserModel,
  mcpServers: ConfiguredMCPServer[],
  tools: OpenAITool[]
): Promise<OpenAIPayload> => {
  const allTools = [...tools, ...mcpServers];

  if (model.settings?.builtInTools?.web_search_preview?.enabled) {
    const webSearchPreview = {
      ...model.settings.builtInTools.web_search_preview,
    };
    delete (webSearchPreview as any).enabled;
    allTools.push(webSearchPreview as any);
  }

  let payload: OpenAIPayload = { input: [], ...model.settings.config };

  if (allTools.length > 0) {
    payload.tools = allTools;
  }

  payload = optionalFields(payload, model);
  return payload;
};

export const configureOpenaiTools = async (
  model: UserModel
): Promise<any[]> => {
  const tools: any[] = [];

  if (model.settings?.tools?.length && model.settings.tools.length > 0) {
    const attachedTools = await getAttachedTools(model.id);
    const toolPromises = attachedTools.map(tool => {
      return {
        type: 'function',
        name: tool.tool.schema.name,
        description:
          tool.tool.schema?.description || `Tool: ${tool.tool.tool_name}`,
        parameters: {
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
      } as OpenAITool;
    });
    tools.push(...toolPromises);
  }

  return tools;
};
