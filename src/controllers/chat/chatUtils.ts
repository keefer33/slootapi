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
  // Handle both formats:
  // 1. Chat completions format: { type: 'function', function: { name: '...', ... } }
  // 2. Responses endpoint format: { type: 'function', name: '...', parameters: {...} }
  const toolCallName = toolCall.function?.name;
  if (!toolCallName || !payload?.tools || !Array.isArray(payload.tools)) {
    return { toolId: '', schema: undefined };
  }

  const tool = payload.tools.find((fd: any) => {
    if (!fd) return false;
    // Check responses endpoint format (name at top level)
    if (fd.name === toolCallName) {
      return true;
    }
    // Check chat completions format (name nested under function)
    if (fd.function?.name === toolCallName) {
      return true;
    }
    return false;
  });

  // Extract toolId and schema based on format
  let toolId = '';
  let schema: any;

  if (tool) {
    // Responses endpoint format
    if (tool.name && tool.parameters) {
      toolId = tool.parameters?.properties?.tool_id?.enum?.[0] || '';
      schema = tool.parameters;
    }
    // Chat completions format
    else if (tool.function) {
      toolId = tool.function?.parameters?.properties?.tool_id?.enum?.[0] || '';
      schema = tool.function?.parameters;
    }
  }

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

  // Use Promise.allSettled to handle individual server failures gracefully
  const results = await Promise.allSettled(
    getMcpServers.map(async (server: any) => {
      try {
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
        console.log(`xAI MCP - Added ${convertedTools.length} tools from MCP server '${server.server_name}':`, convertedTools.map((t: any) => t.function?.name || t.name).join(', '));
        return { success: true, server: server.server_name };
      } catch (error: any) {
        // Log error but don't fail the entire request
        console.error(
          `Failed to load tools from MCP server '${server.server_name}' (${server.server_url}):`,
          error.message || error
        );
        return { success: false, server: server.server_name, error: error.message || error };
      }
    })
  );

  // Log summary of MCP server loading results
  const failedServers = results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return getMcpServers[index]?.server_name || `Server ${index}`;
      }
      if (result.status === 'fulfilled' && !result.value.success) {
        return result.value.server;
      }
      return null;
    })
    .filter(Boolean);

  if (failedServers.length > 0) {
    console.warn(
      `Warning: Failed to load tools from ${failedServers.length} MCP server(s):`,
      failedServers.join(', ')
    );
  }

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

  // Use Promise.allSettled to handle individual server failures gracefully
  const results = await Promise.allSettled(
    (model.settings?.pipedream?.map(async tool => {
      try {
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
        return { success: true, tool: tool.name };
      } catch (error: any) {
        // Log error but don't fail the entire request
        console.error(
          `Failed to load tools from Pipedream MCP server '${tool.name}':`,
          error.message || error
        );
        return { success: false, tool: tool.name, error: error.message || error };
      }
    }) || [])
  );

  // Log summary of Pipedream MCP server loading results
  const failedTools = results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return model.settings?.pipedream?.[index]?.name || `Tool ${index}`;
      }
      if (result.status === 'fulfilled' && !result.value.success) {
        return result.value.tool;
      }
      return null;
    })
    .filter(Boolean);

  if (failedTools.length > 0) {
    console.warn(
      `Warning: Failed to load tools from ${failedTools.length} Pipedream MCP server(s):`,
      failedTools.join(', ')
    );
  }
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

// Helper function to clean up tool parameters - converts enum objects to values
export const cleanToolParameters = (parameters: any): any => {
  if (!parameters || typeof parameters !== 'object') {
    return parameters;
  }

  const cleaned: any = { ...parameters };

  // Clean up properties
  if (cleaned.properties && typeof cleaned.properties === 'object') {
    cleaned.properties = { ...cleaned.properties };
    for (const key in cleaned.properties) {
      const prop = cleaned.properties[key];
      if (prop && typeof prop === 'object' && prop.enum && Array.isArray(prop.enum)) {
        // Check if enum contains objects with 'value' property
        const hasObjectValues = prop.enum.some((item: any) =>
          item && typeof item === 'object' && 'value' in item
        );
        if (hasObjectValues) {
          // Extract 'value' from each enum item
          cleaned.properties[key] = {
            ...prop,
            enum: prop.enum.map((item: any) =>
              item && typeof item === 'object' && 'value' in item ? item.value : item
            ),
          };
        }
      }
    }
  }

  return cleaned;
};

const agentXaiPayload = async (model: UserModel, payload: ChatPayload) => {
  // Grok built-in search tools
  // When search tools are enabled, we need to use the /responses endpoint
  // instead of /chat/completions. Mark the payload accordingly.
  if (model.settings?.builtInTools?.search_parameters) {
    // Mark that we should use responses endpoint for xAI
    (payload as any).useResponsesEndpoint = true;

    // Note: We don't convert messages to input here because the payload will be
    // merged with chatAgent.payload in chatController.ts, which may overwrite it.
    // The conversion from messages to input happens in the handlers (handleResponse/handleStream)
    // after the merge is complete, ensuring we have the final message structure.

    const searchParams = model.settings.builtInTools.search_parameters;

    // For responses endpoint, we need to convert function tools format.
    // Responses endpoint expects: { type: 'function', name: '...', description: '...', parameters: {...} }
    // Chat completions format: { type: 'function', function: { name: '...', ... } }
    // Initialize tools array if it doesn't exist
    if (!payload.tools) {
      payload.tools = [];
    }

    console.log(`xAI agentXaiPayload - Tools at start: ${payload.tools?.length || 0}`, payload.tools?.map((t: any) => ({ type: t.type, name: t.name || t.function?.name })));

    // Convert function tools to responses endpoint format and filter out search tools
    // Responses endpoint expects: { type: 'function', name: '...', description: '...', parameters: {...} }
    const convertedFunctionTools: any[] = [];
    if (payload.tools && Array.isArray(payload.tools)) {
      payload.tools.forEach((tool: any) => {
        if (tool.type === 'function' && tool.function) {
          // Convert to responses endpoint format - name must be at top level
          if (tool.function.name) {
            // Clean up parameters (fix enum objects to values)
            const cleanedParameters = cleanToolParameters(tool.function.parameters || {});
            convertedFunctionTools.push({
              type: 'function',
              name: tool.function.name,
              description: tool.function.description || '',
              parameters: cleanedParameters,
            });
          }
        } else if (
          tool.type !== 'web_search' &&
          tool.type !== 'x_search' &&
          tool.type !== 'web_search_preview'
        ) {
          // For other tool types, check if they already have 'name' at top level
          // If they do, keep them; if not, try to convert them
          if (tool.name) {
            convertedFunctionTools.push(tool);
          } else if (tool.type === 'function') {
            // Try to extract name from function if it exists
            if (tool.function?.name) {
              // Clean up parameters (fix enum objects to values)
              const cleanedParameters = cleanToolParameters(tool.function.parameters || {});
              convertedFunctionTools.push({
                type: 'function',
                name: tool.function.name,
                description: tool.function.description || '',
                parameters: cleanedParameters,
              });
            }
          }
        }
      });
    }

    // Web Search tool configuration
    const webSearchTool: any = {
      type: 'web_search',
    };

    // Apply web search parameters if provided
    if (searchParams.web_search) {
      const webSearch = searchParams.web_search;

      if (webSearch.allowed_domains && webSearch.allowed_domains.length > 0) {
        webSearchTool.allowed_domains = webSearch.allowed_domains;
      }

      if (webSearch.excluded_domains && webSearch.excluded_domains.length > 0) {
        webSearchTool.excluded_domains = webSearch.excluded_domains;
      }

      if (webSearch.enable_image_understanding === true) {
        webSearchTool.enable_image_understanding = true;
      }
    }

    // X Search tool configuration
    const xSearchTool: any = {
      type: 'x_search',
    };

    // Apply X search parameters if provided
    if (searchParams.x_search) {
      const xSearch = searchParams.x_search;

      if (xSearch.allowed_x_handles && xSearch.allowed_x_handles.length > 0) {
        xSearchTool.allowed_x_handles = xSearch.allowed_x_handles;
      }

      if (xSearch.excluded_x_handles && xSearch.excluded_x_handles.length > 0) {
        xSearchTool.excluded_x_handles = xSearch.excluded_x_handles;
      }

      if (xSearch.from_date) {
        xSearchTool.from_date = xSearch.from_date;
      }

      if (xSearch.to_date) {
        xSearchTool.to_date = xSearch.to_date;
      }

      if (xSearch.enable_image_understanding === true) {
        xSearchTool.enable_image_understanding = true;
      }

      if (xSearch.enable_video_understanding === true) {
        xSearchTool.enable_video_understanding = true;
      }
    }

    // Check if sources array contains 'x' or 'web' to determine which search tools to enable
    const sources = searchParams.sources || [];
    const hasWebSource = sources.some((source: any) => source?.type === 'web');
    const hasXSource = sources.some((source: any) => source?.type === 'x');

    // Build array of search tools to add based on sources
    const searchToolsToAdd: any[] = [];
    if (hasWebSource) {
      searchToolsToAdd.push(webSearchTool);
    }
    if (hasXSource) {
      searchToolsToAdd.push(xSearchTool);
    }

    // Combine tools: function tools first (with 'name' field), then search tools
    // The responses endpoint requires function tools to have 'name' at top level
    // However, if sources specify 'x' or 'web', we can add search tools even without function tools
    if (convertedFunctionTools.length > 0) {
      // If we have function tools, put them first to ensure first tool has 'name'
      // Then add search tools after - they should work fine after function tools
      payload.tools = [...convertedFunctionTools, ...searchToolsToAdd];
    } else if (searchToolsToAdd.length > 0) {
      // If no function tools but sources specify search tools, add them directly
      // Based on xAI docs, search tools can be used without function tools when specified in sources
      payload.tools = searchToolsToAdd;
      console.log(`xAI search tools enabled: ${searchToolsToAdd.map((t: any) => t.type).join(', ')} based on sources configuration`);
    } else {
      // No function tools and no search sources specified
      console.warn(
        'xAI search tools skipped: No function tools found and no search sources (x/web) specified in search_parameters.sources.'
      );
      // Don't clear tools array - MCP tools might be added later
      // Just leave payload.tools as-is (it might be undefined or empty, which is fine)
      // If tools are added later (e.g., from MCP servers), they'll be converted in the handlers
    }
  }

  return payload;
};
