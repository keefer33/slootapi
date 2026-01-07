import {
  ChatAgent,
  ToolCall,
  ToolCallResult,
  ToolInfo,
  ToolCallResponse,
  ChatTool,
  BasePayload,
  ChatRequest,
  UserModel,
  ChatPayload,
  ConfiguredMCPServer,
  MCPServer,
} from '../../types';
import { getUserTool } from '../toolsController';
import { callTool } from '../../utils/runToolUtils';
import {
  getAgentMCPServers,
  getAttachedTools,
  optionalFields,
  parseJson,
} from '../../utils/agentUtils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getPipedreamClient } from '../../utils/pipedreamClient';
import { getClient } from '../../utils/supabaseClient';

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
  chatAgent.currentMessage.push(...output_items);
  return chatAgent;
};

export const getToolInfo = (toolCall: ToolCall, payload: any): ToolInfo => {
  const tool = payload.tools.find(
    (fd: any) => fd.function.name === toolCall.function?.name
  );
  const toolId =
    tool?.function?.parameters?.properties?.tool_id?.enum?.[0] || '';
  const schema = tool?.function?.parameters;
  return { toolId, schema };
};

export const callOpenAITool = async (
  toolCall: ToolCall,
  toolId: string,
  schema: any,
  chatAgent: ChatAgent
): Promise<ToolCallResponse> => {
  let args: any;
  if (typeof toolCall.function?.arguments === 'string') {
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error(
        'Failed to parse tool call arguments:',
        toolCall.function.arguments
      );
      args = {};
    }
  } else {
    // Arguments are already an object
    args = toolCall.function?.arguments || {};
  }

  const requiredArgs: any = {};
  schema?.required?.forEach((arg: string) => {
    //return the arg and the default value if the arg is not in the args
    if (!args[arg]) {
      requiredArgs[arg] = schema.properties[arg].default;
    }
  });
  const completedArgs = { ...args, ...requiredArgs };

  if (chatAgent.mcpServers.length > 0) {
    const mcpServer = chatAgent.mcpServers.find(
      (mcpServer: any) => mcpServer.name === toolId
    );
    if (mcpServer) {
      const result = await mcpServer.client.callTool({
        name: toolCall.function?.name,
        arguments: completedArgs,
      });
      let resultString = '',
        getUsage = null;
      if (typeof result === 'object') {
        if (result.content[0].text) {
          const resultOutput: any = parseJson(result.content[0].text);
          if (resultOutput.success) {
            getUsage = resultOutput?.data?.usage;
            resultString = JSON.stringify(resultOutput?.data?.result);
          } else {
            resultString = resultOutput?.data;
          }
        } else {
          resultString = JSON.stringify(result);
        }
      } else {
        resultString = result;
      }
      const toolCallResult: ToolCallResult = {
        //type: 'tool_call_result',
        role: 'tool',
        content: resultString,
        tool_call_id: toolCall.id || toolCall.function?.name || '',
        // name: toolCall.function?.name || undefined,
      };
      return { toolCallResult, usage: getUsage || null };
    }
  }

  const tool = await getUserTool(toolId, chatAgent.req.user.userId);
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
    //type: 'tool_call_result',
    role: 'tool',
    content:
      typeof result.result === 'object'
        ? JSON.stringify(result.result)
        : result.result,
    tool_call_id: toolCall.id || toolCall.function?.name || '',
    name: toolCall.function?.name || undefined,
  };
  return { toolCallResult, usage: result?.usage || null };
};

export const createPayload = async (req: ChatRequest) => {
  let payload: BasePayload = {};
  const model = req.user.userModel;
  const balance = req.user.userProfile.balance;

  const tools = (await configureChatTools(model, balance)) as ChatTool[];
  payload = await agentChatPayload(model, tools, req);
  return payload;
};

export const configureToolsFromMCPServers = async (
  model: UserModel,
  req: ChatRequest,
  chatAgent: ChatAgent
) => {
  //check if agent config has mcp servers
  if (model.settings?.mcp_servers) {
    //get custom mcp servers
    const getMcpServers = await getAgentMCPServers(model.settings?.mcp_servers, req);
    chatAgent = await configureMCPServers(getMcpServers, model, req, chatAgent);
  }
  return chatAgent;
};

export const configureMCPServers = async (
  getMcpServers: MCPServer[] | ConfiguredMCPServer[] | any,
  model: UserModel,
  req: ChatRequest,
  chatAgent: ChatAgent
): Promise<ChatAgent> => {
  // Initialize tools array if it doesn't exist
  if (!chatAgent.payload.tools) {
    chatAgent.payload.tools = [];
  }

  // Use Promise.all to wait for all async operations
  await Promise.all(
    getMcpServers.map(async (server: any) => {
      let connectToken;
      if (server.type === 'connect' && server.auth_token) {
        connectToken = server.auth_token;
      } else if (server.type === 'public' || server.type === 'private') {
        connectToken = req.user.token;
      }

      if (
        server.server_url === `https://mcp.sloot.ai/${server.id}` &&
        process.env.NODE_ENV &&
        process.env.NODE_ENV !== 'development'
      ) {
        server.server_url = `http://slootmcp:3000/${server.id}`;
      }
      const transport = new StreamableHTTPClientTransport(
        new URL(server.server_url),
        {
          requestInit: {
            headers: {
              Authorization: `Bearer ${connectToken}`,
            },
          },
        }
      );

      // Initialize MCP client
      const mcpClient = new Client({
        name: server.server_name,
        version: '1.0.0',
      });

      await mcpClient.connect(transport as any);
      chatAgent.mcpServers.push({
        name: server.server_name,
        client: mcpClient,
      });
      // Get available tools from MCP
      const toolsResponse = await mcpClient.listTools();
      const mcpTools = toolsResponse.tools || [];
      const convertedTools = mcpTools
        .map(tool => {
          const checkedTool = chatAgent.payload.tools?.find(
            (t: any) => t.function.name === tool.name
          );
          if (!checkedTool) {
            return {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                parameters: {
                  ...tool.inputSchema,
                  properties: {
                    ...tool.inputSchema.properties,
                    tool_id: {
                      type: 'string',
                      description: 'Internal tool identifier',
                      enum: [server.server_name],
                    },
                  },
                },
              },
            } as ChatTool;
          }
          return null; // Return null for duplicate tools
        })
        .filter(Boolean); // Remove null values

      chatAgent.payload.tools?.push(...convertedTools);
    })
  );

  return chatAgent;
};

export const configurePipedreamMCPServers = async (
  model: UserModel,
  req: ChatRequest,
  chatAgent: ChatAgent
): Promise<ChatAgent> => {
  // Initialize tools array if it doesn't exist
  if (!chatAgent.payload.tools) {
    chatAgent.payload.tools = [];
  }

  // Use Promise.all to wait for all async operations
  await Promise.all(
    model.settings?.pipedream?.map(async tool => {
      const pd = getPipedreamClient();
      const accessToken = await pd.rawAccessToken;
      // Create MCP transport
      const transport = new StreamableHTTPClientTransport(
        new URL('https://remote.mcp.pipedream.net'),
        {
          requestInit: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'x-pd-project-id': process.env.PIPEDREAM_PROJECT_ID!,
              'x-pd-environment': process.env.PIPEDREAM_ENVIRONMENT!,
              'x-pd-external-user-id': req.user.userId,
              'x-pd-app-slug': tool.name,
            },
          },
        }
      );
      // Initialize MCP client
      const clientName = `${tool.name}-pipedream-client`;
      const mcpClient = new Client({
        name: clientName,
        version: '1.0.0',
      });
      await mcpClient.connect(transport as any);
      chatAgent.mcpServers.push({ name: clientName, client: mcpClient });

      // Get available tools from MCP
      const toolsResponse = await mcpClient.listTools();
      const mcpTools = toolsResponse.tools || [];
      const convertedTools = mcpTools
        .map(tool => {
          const checkedTool = chatAgent.payload.tools?.find(
            (t: any) => t.function.name === tool.name
          );
          if (!checkedTool) {
            return {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description || `Tool: ${tool.name}`,
                parameters: {
                  ...tool.inputSchema,
                  properties: {
                    ...tool.inputSchema.properties,
                    tool_id: {
                      type: 'string',
                      description: 'Internal tool identifier',
                      enum: [clientName],
                    },
                  },
                },
              },
            } as ChatTool;
          }
          return null; // Return null for duplicate tools
        })
        .filter(Boolean); // Remove null values
      chatAgent.payload.tools?.push(...convertedTools);
    }) || []
  );
  return chatAgent;
};

export const agentChatPayload = async (
  model: UserModel,
  tools: ChatTool[],
  req: ChatRequest
): Promise<ChatPayload> => {
  let payload: ChatPayload = {
    messages: [],
    model: model.model_id.config.model_name,
    ...model.settings.config,
  };

  if (model.settings.config.instructions) {
    if (!req.body.thread_id) {
      payload.messages.push({
        role: 'system',
        content: [{ type: 'text', text: model.settings.config.instructions }],
      });
    }
    delete (payload as any).instructions;
  }

  if (tools.length > 0) {
    payload.tools = tools;
  }

  //builtintools
  if (model.model_id.brand_id.slug === 'xai') {
    payload = await agentXaiPayload(model, payload);
  }

  payload = optionalFields(payload, model);
  return payload;
};

export const configureChatTools = async (
  model: UserModel,
  balance: number
): Promise<any[]> => {
  const tools: any[] = [];

  if (model.settings?.tools?.length && model.settings.tools.length > 0) {
    const attachedTools = await getAttachedTools(model.id);

    // Check for Sloot tools and validate balance
    const hasSlootTools = attachedTools.some(tool => tool.tool.is_sloot);
    if (hasSlootTools && balance <= 0) {
      const error = new Error(
        'Insufficient funds to use Sloot tools. Please add funds to your account.'
      );
      (error as any).error = 'Insufficient Funds';
      (error as any).message =
        'Insufficient funds to use Sloot tools. Please add funds to your account.';
      throw error;
    }

    const toolPromises = mapTools(attachedTools);
    tools.push(...toolPromises);
  }

  return tools;
};

const mapTools = (tools: any[]) => {
  return tools.map(tool => {
    return {
      type: 'function',
      function: {
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
      },
    } as ChatTool;
  });
};

const agentXaiPayload = async (model: UserModel, payload: ChatPayload) => {
  //gronk built in tools
  if (model.settings?.builtInTools?.search_parameters) {
    payload.search_parameters = model.settings?.builtInTools?.search_parameters;
  }

  return payload;
};
