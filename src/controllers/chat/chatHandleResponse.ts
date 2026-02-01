import { ChatAgent, ChatResponse } from '../../types';
import { getModelPricing } from '../utils/usage';
import { handleToolCall, cleanToolParameters } from './chatUtils';
import { ToolCall } from '../../types';
import { createThreadMessage } from '../../utils/threadsUtils';

export const handleResponse = async (chatAgent: ChatAgent): Promise<void> => {
  // Check if we should use responses endpoint (for xAI with search tools)
  const useResponsesEndpoint =
    (chatAgent.payload as any).useResponsesEndpoint ||
    chatAgent.req.user.userModel?.model_id?.brand_id?.slug === 'xai' &&
      chatAgent.req.user.userModel?.settings?.builtInTools?.search_parameters;

  // Convert messages to input format for responses endpoint if needed
  if (useResponsesEndpoint && chatAgent.payload.messages && !chatAgent.payload.input) {
    // Filter out assistant messages with tool_calls - responses endpoint doesn't accept them
    const inputMessages = chatAgent.payload.messages
      .filter((msg: any) => {
        // Exclude assistant messages with tool_calls
        if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          return false;
        }
        return true;
      })
      .map((msg: any) => {
      if (msg.content && Array.isArray(msg.content)) {
        return {
          role: msg.role,
          content: msg.content.map((contentItem: any) => {
            if (msg.role === 'user') {
              // User messages: convert 'text' to 'input_text'
              if (contentItem.type === 'text') {
                return {
                  type: 'input_text',
                  text: contentItem.text || '',
                };
              }
            } else if (msg.role === 'assistant') {
              // Assistant messages: convert 'text' to 'output_text'
              if (contentItem.type === 'text') {
                return {
                  type: 'output_text',
                  text: contentItem.text || '',
                };
              }
            }
            return contentItem;
          }),
        };
      }
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: [
            {
              type: msg.role === 'user' ? 'input_text' : 'output_text',
              text: msg.content,
            },
          ],
        };
      }
      return msg;
    });
    (chatAgent.payload as any).input = inputMessages;
    delete chatAgent.payload.messages;
  }

  // Ensure tools are in the correct format for responses endpoint
  // This is needed because tools might be added after agentXaiPayload is called (e.g., from MCP servers)
  if (useResponsesEndpoint && chatAgent.payload.tools && Array.isArray(chatAgent.payload.tools)) {
    console.log(`xAI Non-Streaming - Converting ${chatAgent.payload.tools.length} tools to responses endpoint format. Tools before conversion:`, chatAgent.payload.tools.map((t: any) => ({ type: t.type, name: t.name || t.function?.name, hasFunction: !!t.function })));
    chatAgent.payload.tools = chatAgent.payload.tools.map((tool: any) => {
      // If tool is in chat completions format, convert to responses endpoint format
      if (tool.type === 'function' && tool.function && !tool.name) {
        // Clean up parameters (fix enum objects to values)
        const cleanedParameters = cleanToolParameters(tool.function.parameters || {});
        return {
          type: 'function',
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: cleanedParameters,
        };
      }
      // If tool already has name at top level, clean its parameters
      if (tool.name && tool.parameters) {
        return {
          ...tool,
          parameters: cleanToolParameters(tool.parameters),
        };
      }
      // For search tools, keep as-is
      if (tool.type === 'web_search' || tool.type === 'x_search') {
        return tool;
      }
      return tool;
    });
    console.log(`xAI Non-Streaming - Tools after conversion:`, chatAgent.payload.tools.map((t: any) => ({ type: t.type, name: t.name, hasParameters: !!t.parameters })));
  }

  let response: any;
  if (useResponsesEndpoint) {
    // Use responses endpoint for xAI search tools
    response = await chatAgent.api!.responses.create(chatAgent.payload);

    // Debug: Log response structure to understand the format
    console.log('xAI Responses API response:', JSON.stringify(response, null, 2));

    // Handle responses API format
    if (!response?.output) {
      const errorResponse: ChatResponse = {
        success: false,
        error: 'No response from the model',
        message:
          'We are not able to process your request, please try again later',
        ...response,
      };
      chatAgent.res.status(200).json(errorResponse);
      return;
    }

    const usage = getModelPricing(
      response.usage || {},
      chatAgent.req.user.userModel
    );
    chatAgent.usage.push(usage);

    // Handle tool calls from responses API
    const toolCalls = response.output
      .filter((output: any) => output.type === 'function_call')
      .map((output: any) => ({
        type: 'function',
        id: output.call_id || '',
        function: {
          name: output.name || '',
          arguments: JSON.stringify(output.arguments || {}),
        },
      }));

    if (toolCalls.length > 0) {
      chatAgent.currentMessage.push({
        role: 'assistant',
        tool_calls: toolCalls,
      });

      const updatedChatAgent = await handleToolCall(
        toolCalls as ToolCall[],
        chatAgent
      );

      // For responses endpoint, we need to use 'input' not 'messages'
      // Remove 'input' if it exists, and convert messages to input format
      const secondPayload: any = {
        ...updatedChatAgent.payload,
      };

      // Remove old input and messages to avoid conflicts
      delete secondPayload.input;
      delete secondPayload.messages;

      // Convert currentMessage to input format for responses endpoint
      if (useResponsesEndpoint) {
        // For responses endpoint, we should only include the most recent tool results
        // Exclude all assistant messages (with or without tool_calls) and previous conversation
        // Find the most recent assistant message with tool_calls to identify which tool results to include
        let lastToolCallIndex = -1;
        for (let i = updatedChatAgent.currentMessage.length - 1; i >= 0; i--) {
          const msg = updatedChatAgent.currentMessage[i];
          if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
            lastToolCallIndex = i;
            break;
          }
        }

        // Only include tool results that come after the last assistant message with tool_calls
        // and any new user messages after that
        // CRITICAL: Exclude ALL assistant messages (both with tool_calls and with content)
        const messagesAfterToolCalls = updatedChatAgent.currentMessage.slice(lastToolCallIndex + 1);
        console.log('xAI Non-Streaming - Messages after last tool_calls:', messagesAfterToolCalls.length);
        console.log('xAI Non-Streaming - Last tool call index:', lastToolCallIndex);
        console.log('xAI Non-Streaming - Messages after tool_calls (before filter):', JSON.stringify(messagesAfterToolCalls.map((m: any) => ({ role: m.role, hasToolCalls: !!m.tool_calls, hasContent: !!m.content })), null, 2));

        // First, filter out ALL assistant messages (regardless of whether they have tool_calls or content)
        const filteredMessages = messagesAfterToolCalls.filter((msg: any) => {
          // Exclude ALL assistant messages
          if (msg.role === 'assistant') {
            console.log('xAI Non-Streaming - Filtering out assistant message:', JSON.stringify({ role: msg.role, hasToolCalls: !!msg.tool_calls, hasContent: !!msg.content }));
            return false;
          }
          // Only allow 'tool' and 'user' roles
          if (msg.role !== 'tool' && msg.role !== 'user') {
            console.log('xAI Non-Streaming - Filtering out unexpected role:', msg.role);
            return false;
          }
          return true;
        });

        console.log('xAI Non-Streaming - Messages after filter:', filteredMessages.length);
        console.log('xAI Non-Streaming - Filtered messages:', JSON.stringify(filteredMessages.map((m: any) => ({ role: m.role })), null, 2));

        const inputMessages = filteredMessages
          .map((msg: any) => {
            // Handle tool results - responses endpoint expects specific format
            // Note: 'name' field is only allowed for 'user' messages, not 'tool' messages
            // Tool content must be a string, not an array
            if (msg.role === 'tool') {
              let toolContent = '';
              if (typeof msg.content === 'string') {
                toolContent = msg.content;
              } else if (Array.isArray(msg.content)) {
                // Extract text from array format
                toolContent = msg.content
                  .map((item: any) => {
                    if (item.type === 'output_text' || item.type === 'text') {
                      return item.text || '';
                    }
                    return typeof item === 'string' ? item : JSON.stringify(item);
                  })
                  .join('');
              } else {
                toolContent = JSON.stringify(msg.content);
              }
              return {
                role: 'tool',
                content: toolContent,
                tool_call_id: msg.tool_call_id || msg.call_id,
                // Do not include 'name' field - it's only allowed for user messages
              };
            }

            if (msg.role === 'user') {
              if (msg.content && Array.isArray(msg.content)) {
                return {
                  role: 'user',
                  content: msg.content.map((contentItem: any) => {
                    if (contentItem.type === 'text') {
                      return {
                        type: 'input_text',
                        text: contentItem.text || '',
                      };
                    }
                    return contentItem;
                  }),
                };
              }
              if (typeof msg.content === 'string') {
                return {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: msg.content,
                    },
                  ],
                };
              }
            }
            // For other message types, keep as-is
            return msg;
          });
        secondPayload.input = inputMessages;
      } else {
        // For chat completions endpoint, use messages
        secondPayload.messages = [...updatedChatAgent.currentMessage];
      }

      // Ensure tools are in the correct format for responses endpoint
      if (useResponsesEndpoint && secondPayload.tools && Array.isArray(secondPayload.tools)) {
        secondPayload.tools = secondPayload.tools.map((tool: any) => {
          // If tool is in chat completions format, convert to responses endpoint format
          if (tool.type === 'function' && tool.function && !tool.name) {
            // Clean up parameters (fix enum objects to values)
            const cleanedParameters = cleanToolParameters(tool.function.parameters || {});
            return {
              type: 'function',
              name: tool.function.name,
              description: tool.function.description || '',
              parameters: cleanedParameters,
            };
          }
          // If tool already has name at top level, clean its parameters
          if (tool.name && tool.parameters) {
            return {
              ...tool,
              parameters: cleanToolParameters(tool.parameters),
            };
          }
          // For search tools, keep as-is
          if (tool.type === 'web_search' || tool.type === 'x_search') {
            return tool;
          }
          return tool;
        });
      }

      updatedChatAgent.payload = secondPayload;
      await handleResponse(updatedChatAgent);
    } else {
      // Add text response from responses API
      // Extract all text outputs and combine them
      const textOutputs = response.output.filter(
        (output: any) => output.type === 'text'
      );

      // Combine all text content
      const textContent = textOutputs
        .map((output: any) => output.text || '')
        .join('');

      // If no text content found, check if there's content in a different format
      let finalTextContent = textContent;
      if (!finalTextContent && response.output && response.output.length > 0) {
        // Try to extract text from any output item
        const anyText = response.output.find(
          (output: any) => output.text || output.content
        );
        if (anyText) {
          finalTextContent = anyText.text || anyText.content || '';
        }
      }

      // Debug: Log to see what we're getting
      console.log('xAI Non-Streaming - Response output:', JSON.stringify(response.output, null, 2));
      console.log('xAI Non-Streaming - Extracted text content:', finalTextContent);
      console.log('xAI Non-Streaming - currentMessage before push:', JSON.stringify(chatAgent.currentMessage, null, 2));

      // Format message to match chat completions format for browser compatibility
      // Use string format for assistant messages (OpenAI format)
      const assistantMessage: any = {
        role: 'assistant',
        content: finalTextContent || '', // Use string format to match OpenAI/chat completions format
      };

      chatAgent.currentMessage.push(assistantMessage);

      console.log('xAI Non-Streaming - currentMessage after push:', JSON.stringify(chatAgent.currentMessage, null, 2));

      chatAgent.threadId = await createThreadMessage(
        chatAgent.req,
        chatAgent.threadId,
        chatAgent.req.user.userId,
        chatAgent.currentMessage,
        chatAgent.req.user.userModel.settings,
        {},
        chatAgent.usage
      );

      // Format response to match chat completions format for browser
      // Include both choices (for compatibility) and the full currentMessage array
      // The browser may read from either choices[0].message or messages array
      const successResponse: ChatResponse = {
        success: true,
        thread_id: chatAgent.threadId,
        choices: [
          {
            message: assistantMessage,
            finish_reason: 'stop',
            index: 0,
          },
        ],
        // Include full messages array with both user and assistant messages
        messages: chatAgent.currentMessage,
        usage: response.usage,
        model: response.model || chatAgent.payload.model,
        id: response.id,
        // Also include the raw response for debugging
        raw_response: response,
      };

      console.log('xAI Non-Streaming - Final successResponse:', JSON.stringify(successResponse, null, 2));
      chatAgent.res.status(200).json(successResponse);
    }
  } else {
    // Use chat completions endpoint (default)
    response = await chatAgent.api!.chat.completions.create(
      chatAgent.payload
    );

    if (!response?.choices) {
      const errorResponse: ChatResponse = {
        success: false,
        error: 'No response from the model',
        message:
          'We are not able to process your request, please try again later',
        ...response,
      };
      chatAgent.res.status(200).json(errorResponse);
      return;
    }
    const usage = getModelPricing(
      response.usage || {},
      chatAgent.req.user.userModel
    );
    chatAgent.usage.push(usage);
    if (
      response?.choices?.[0]?.message?.tool_calls?.length &&
      response.choices[0].message.tool_calls.length > 0
    ) {
      chatAgent.currentMessage.push({
        role: 'assistant',
        tool_calls: response.choices[0].message.tool_calls,
      });

      //call the functions for the tool calls
      const updatedChatAgent = await handleToolCall(
        response.choices[0].message.tool_calls as ToolCall[],
        chatAgent
      );
      const secondPayload = {
        ...updatedChatAgent.payload,
        messages: [...updatedChatAgent.currentMessage],
      };
      updatedChatAgent.payload = secondPayload;
      await handleResponse(updatedChatAgent);
    } else {
      // Ensure content is a string, not an array (for frontend compatibility)
      const assistantMessage = response.choices?.[0]?.message;
      let content = assistantMessage?.content;

      // Convert array content to string if needed
      if (Array.isArray(content)) {
        content = content
          .map((item: any) => (typeof item === 'string' ? item : item?.text || ''))
          .join('');
      }

      chatAgent.currentMessage.push({
        role: 'assistant',
        content: content || '', // Use string format to match OpenAI/chat completions format
        ...(assistantMessage?.tool_calls && { tool_calls: assistantMessage.tool_calls }),
      });
      chatAgent.threadId = await createThreadMessage(
        chatAgent.req,
        chatAgent.threadId,
        chatAgent.req.user.userId,
        chatAgent.currentMessage,
        chatAgent.req.user.userModel.settings,
        {},
        chatAgent.usage
      );
      const successResponse: ChatResponse = {
        success: true,
        thread_id: chatAgent.threadId,
        ...response,
      };
      chatAgent.res.status(200).json(successResponse);
    }
  }
};

const t = {}
