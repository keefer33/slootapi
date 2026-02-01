import { ChatAgent } from '../../types';
import { sendSSEEvent } from '../../utils/streamingUtils';
import { getModelPricing } from '../utils/usage';
import { ToolCall } from '../../types';
import { handleToolCall, cleanToolParameters } from './chatUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

// Function to handle the first stream and collect tool results
export const handleStream = async (chatAgent: ChatAgent, recursionDepth: number = 0): Promise<any> => {
  // Prevent infinite recursion (max 10 tool call iterations)
  if (recursionDepth > 10) {
    console.error('Maximum recursion depth reached for tool calls. Stopping to prevent infinite loop.');
    sendSSEEvent(chatAgent.res, {
      type: 'error',
      text: 'Maximum tool call recursion depth reached',
      thread_id: chatAgent.threadId || '',
    });
    return;
  }

  // Check if we should use responses endpoint (for xAI with search tools)
  const useResponsesEndpoint =
    (chatAgent.payload as any).useResponsesEndpoint ||
    (chatAgent.req.user.userModel?.model_id?.brand_id?.slug === 'xai' &&
      chatAgent.req.user.userModel?.settings?.builtInTools?.search_parameters);

  console.log('xAI Streaming - useResponsesEndpoint:', useResponsesEndpoint);
  console.log('xAI Streaming - payload.useResponsesEndpoint:', (chatAgent.payload as any).useResponsesEndpoint);
  console.log('xAI Streaming - brand slug:', chatAgent.req.user.userModel?.model_id?.brand_id?.slug);
  console.log('xAI Streaming - search_parameters:', chatAgent.req.user.userModel?.settings?.builtInTools?.search_parameters);

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
    console.log(`xAI Streaming - Converting ${chatAgent.payload.tools.length} tools to responses endpoint format. Tools before conversion:`, chatAgent.payload.tools.map((t: any) => ({ type: t.type, name: t.name || t.function?.name, hasFunction: !!t.function })));
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
    console.log(`xAI Streaming - Tools after conversion:`, chatAgent.payload.tools.map((t: any) => ({ type: t.type, name: t.name, hasParameters: !!t.parameters })));
  }

  const updatedPayload = {
    ...chatAgent.payload,
    stream: true,
    stream_options: {
      include_usage: true,
    },
  };
  chatAgent.payload = updatedPayload;
  let message = '';
  const finalToolCalls: ToolCall[] = [];

  let stream: any;
  if (useResponsesEndpoint) {
    // Use responses endpoint for xAI search tools
    console.log('xAI Streaming - Using responses endpoint');
    console.log('xAI Streaming - Payload:', JSON.stringify(chatAgent.payload, null, 2));
    stream = await chatAgent.api!.responses.create(chatAgent.payload);
  } else {
    // Use chat completions endpoint (default)
    console.log('xAI Streaming - Using chat completions endpoint');
    stream = await chatAgent.api!.chat.completions.stream(chatAgent.payload);
  }

  let updateStatus = 'Message in progress';
  let lastSentStatus = '';

  for await (const chunk of stream) {
    // Log all chunks for debugging
    if (useResponsesEndpoint) {
      console.log('xAI Streaming - Received chunk type:', chunk.type, 'chunk:', JSON.stringify(chunk, null, 2));
    }

    if (useResponsesEndpoint) {
      // Handle responses API streaming format
      switch (chunk.type) {
        case 'response.created':
          chatAgent.payload.previous_response_id = chunk.response?.id;
          updateStatus = 'Response created';
          // Only send status update if it changed
          if (updateStatus !== lastSentStatus) {
            sendSSEEvent(chatAgent.res, {
              type: 'updates',
              text: { type: 'in_progress', status: updateStatus },
              thread_id: chatAgent.threadId || '',
            });
            lastSentStatus = updateStatus;
          }
          break;
        case 'response.output_item.added':
          if (chunk.item?.type === 'function_call' && chunk.item?.name) {
            // Handle arguments - responses endpoint may send as object or string
            let argumentsValue: string;
            if (typeof chunk.item.arguments === 'string') {
              // Already a string, use as-is
              argumentsValue = chunk.item.arguments;
            } else if (chunk.item.arguments && typeof chunk.item.arguments === 'object') {
              // Object, stringify it
              argumentsValue = JSON.stringify(chunk.item.arguments);
            } else {
              // No arguments, use empty object
              argumentsValue = '{}';
            }

            finalToolCalls[chunk.output_index || 0] = {
              id: chunk.item.call_id || '',
              type: 'function',
              function: {
                name: chunk.item.name,
                arguments: argumentsValue,
              },
            };
            updateStatus = 'Tool call added: ' + chunk.item.name;
            // Only send status update if it changed
            if (updateStatus !== lastSentStatus) {
              sendSSEEvent(chatAgent.res, {
                type: 'updates',
                text: { type: 'in_progress', status: updateStatus },
                thread_id: chatAgent.threadId || '',
              });
              lastSentStatus = updateStatus;
            }
          }
          break;
        case 'response.output_text.delta':
          // Handle incremental text deltas
          if (chunk.delta) {
            message += chunk.delta;
            sendSSEEvent(chatAgent.res, {
              type: 'text',
              text: chunk.delta,
              thread_id: chatAgent.threadId || '',
            });
            // Only update status on first delta
            if (updateStatus !== 'Message in progress') {
              updateStatus = 'Message in progress';
              sendSSEEvent(chatAgent.res, {
                type: 'updates',
                text: { type: 'in_progress', status: updateStatus },
                thread_id: chatAgent.threadId || '',
              });
              lastSentStatus = updateStatus;
            }
          }
          break;
        case 'response.output_text.done':
          // Final text is available in chunk.text
          if (chunk.text && !message) {
            // If we didn't accumulate from deltas, use the final text
            message = chunk.text;
          }
          updateStatus = 'Text output complete';
          // Only send status update if it changed
          if (updateStatus !== lastSentStatus) {
            sendSSEEvent(chatAgent.res, {
              type: 'updates',
              text: { type: 'in_progress', status: updateStatus },
              thread_id: chatAgent.threadId || '',
            });
            lastSentStatus = updateStatus;
          }
          break;
        case 'response.completed':
          // Response is complete - add the message
          console.log('xAI Streaming - response.completed received, message:', message, 'finalToolCalls.length:', finalToolCalls.length);
          console.log('xAI Streaming - chunk.response?.output:', JSON.stringify(chunk.response?.output, null, 2));

          // Extract text from response.output if message is still empty
          if (!message && chunk.response?.output) {
            // Look for text output items (type === 'text')
            const textOutputs = chunk.response.output.filter(
              (output: any) => output.type === 'text'
            );
            if (textOutputs.length > 0) {
              // Combine all text outputs
              message = textOutputs
                .map((output: any) => output.text || '')
                .join('');
              console.log('xAI Streaming - Extracted message from response.output:', message);
            } else {
              // Fallback: look for any output with text property
              const anyTextOutput = chunk.response.output.find(
                (output: any) => output.text || output.content?.text
              );
              if (anyTextOutput) {
                message = anyTextOutput.text || anyTextOutput.content?.text || '';
                console.log('xAI Streaming - Extracted message from fallback:', message);
              }
            }
          }

          if (chunk.response?.usage) {
            const usage = getModelPricing(
              chunk.response.usage,
              chatAgent.req.user.userModel
            );
            chatAgent.usage.push(usage);
          }

          // Add the accumulated message when response is completed
          // Format to match OpenAI format (content as string for assistant messages)
          if (message && !finalToolCalls.length) {
            console.log('xAI Streaming - Adding assistant message:', message);
            chatAgent.currentMessage.push({
              role: 'assistant',
              content: message, // Use string format to match OpenAI/chat completions format
            });
            console.log('xAI Streaming - currentMessage after push:', JSON.stringify(chatAgent.currentMessage, null, 2));
          } else {
            console.log('xAI Streaming - NOT adding assistant message. message:', message, 'finalToolCalls.length:', finalToolCalls.length);
          }
          break;
        case 'response.done':
          // Legacy event - handle if response.completed isn't received
          console.log('xAI Streaming - response.done received, message:', message, 'finalToolCalls.length:', finalToolCalls.length);
          if (chunk.response?.usage) {
            const usage = getModelPricing(
              chunk.response.usage,
              chatAgent.req.user.userModel
            );
            chatAgent.usage.push(usage);
          }
          // Add the accumulated message when response is done
          if (message && !finalToolCalls.length) {
            console.log('xAI Streaming - Adding assistant message (from response.done):', message);
            chatAgent.currentMessage.push({
              role: 'assistant',
              content: message, // Use string format to match OpenAI/chat completions format
            });
          }
          break;
        case 'error':
          // Handle error chunks
          console.error('xAI Streaming - Error chunk received:', chunk.message || chunk);
          sendSSEEvent(chatAgent.res, {
            type: 'error',
            text: chunk.message || 'An error occurred while processing the request',
            thread_id: chatAgent.threadId || '',
          });
          break;
        default:
          // Log unhandled chunk types for debugging
          console.log('xAI Streaming - Unhandled chunk type:', chunk.type, 'chunk:', JSON.stringify(chunk, null, 2));
          break;
      }
    } else {
      // Handle chat completions streaming format
      if (chunk?.choices[0]?.delta?.content) {
        message += chunk?.choices[0]?.delta?.content;
        sendSSEEvent(chatAgent.res, {
          type: 'text',
          text: chunk?.choices[0]?.delta?.content,
          thread_id: chatAgent.threadId || '',
        });
        // Only update status on first content delta
        if (updateStatus !== 'Message in progress') {
          updateStatus = 'Message in progress';
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: updateStatus,
            },
            thread_id: chatAgent.threadId || '',
          });
          lastSentStatus = updateStatus;
        }
      }

      if (chunk?.choices[0]?.delta?.tool_calls) {
        updateStatus = 'Tool calls in progress';
        // Only send status update if it changed
        if (updateStatus !== lastSentStatus) {
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: updateStatus,
            },
            thread_id: chatAgent.threadId || '',
          });
          lastSentStatus = updateStatus;
        }
        // Handle tool calls with proper argument accumulation
        chunk.choices[0].delta.tool_calls.forEach(
        (deltaToolCall: any, chunkIndex: number) => {
          // Use chunk index as fallback if deltaToolCall.index is undefined
          const toolCallIndex =
            deltaToolCall.index !== undefined
              ? deltaToolCall.index
              : chunkIndex;

          const existingIndex = finalToolCalls.findIndex(
            tc => tc.index === toolCallIndex
          );

          if (existingIndex >= 0) {
            // Update existing tool call
            const existing = finalToolCalls[existingIndex];
            if (existing && existing.function) {
              if (deltaToolCall.function?.name) {
                existing.function.name = deltaToolCall.function.name;
              }
              if (deltaToolCall.function?.arguments) {
                existing.function.arguments =
                  (existing.function.arguments || '') +
                  deltaToolCall.function.arguments;
              }
              if (deltaToolCall.id) {
                existing.id = deltaToolCall.id;
              }
            }
          } else {
            // Create new tool call
            updateStatus = 'Tool call added: ' + deltaToolCall.function?.name;
            sendSSEEvent(chatAgent.res, {
              type: 'updates',
              text: {
                type: 'in_progress',
                status: updateStatus,
              },
              thread_id: chatAgent.threadId || '',
            });
            finalToolCalls.push({
              index: toolCallIndex,
              id: deltaToolCall.id || '',
              type: 'function',
              function: {
                name: deltaToolCall.function?.name || '',
                arguments: deltaToolCall.function?.arguments || '',
              },
            });
          }
        }
      );
    }

      if (chunk?.choices[0]?.finish_reason === 'stop') {
        // Format to match OpenAI format (content as string for assistant messages)
        chatAgent.currentMessage.push({
          role: 'assistant',
          content: message, // Use string format to match OpenAI/chat completions format
        });
      }

      if (chunk?.usage) {
        const usage = getModelPricing(chunk.usage, chatAgent.req.user.userModel);
        chatAgent.usage.push(usage);
      }
    }

    sendSSEEvent(chatAgent.res, {
      type: 'updates',
      text: { type: 'in_progress', status: updateStatus },
      thread_id: chatAgent.threadId || '',
    });
  }

  if (finalToolCalls.length > 0) {
    let combinedToolCalls = '';
    const toolCallsUpdates = finalToolCalls.map(toolCall => {
      combinedToolCalls += ` ${toolCall.function?.name} `;
      return {
        type: 'function',
        id: toolCall.id || toolCall.function?.name || '',
        function: {
          ...toolCall.function,
          arguments: toolCall.function?.arguments || '',
        },
      };
    });

    chatAgent.currentMessage.push({
      role: 'assistant',
      tool_calls: toolCallsUpdates,
    });
    updateStatus = 'Executing tool calls: ' + combinedToolCalls;
    sendSSEEvent(chatAgent.res, {
      type: 'updates',
      text: {
        type: 'in_progress',
        status: updateStatus,
      },
      thread_id: chatAgent.threadId || '',
    });
    const updatedChatAgent = await handleToolCall(finalToolCalls, chatAgent);

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
      console.log('xAI Streaming - Messages after last tool_calls:', messagesAfterToolCalls.length);
      console.log('xAI Streaming - Last tool call index:', lastToolCallIndex);
      console.log('xAI Streaming - Messages after tool_calls (before filter):', JSON.stringify(messagesAfterToolCalls.map((m: any) => ({ role: m.role, hasToolCalls: !!m.tool_calls, hasContent: !!m.content })), null, 2));

      // First, filter out ALL assistant messages (regardless of whether they have tool_calls or content)
      const filteredMessages = messagesAfterToolCalls.filter((msg: any) => {
        // Exclude ALL assistant messages
        if (msg.role === 'assistant') {
          console.log('xAI Streaming - Filtering out assistant message:', JSON.stringify({ role: msg.role, hasToolCalls: !!msg.tool_calls, hasContent: !!msg.content, contentType: Array.isArray(msg.content) ? 'array' : typeof msg.content }));
          return false;
        }
        // Only allow 'tool' and 'user' roles
        if (msg.role !== 'tool' && msg.role !== 'user') {
          console.log('xAI Streaming - Filtering out unexpected role:', msg.role);
          return false;
        }
        return true;
      });

      console.log('xAI Streaming - Messages after filter:', filteredMessages.length);
      console.log('xAI Streaming - Filtered messages:', JSON.stringify(filteredMessages.map((m: any) => ({ role: m.role })), null, 2));

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
      console.log('xAI Streaming - Final input messages for recursive call:', JSON.stringify(inputMessages, null, 2));
      secondPayload.input = inputMessages;
    } else {
      // For chat completions endpoint, use messages
      secondPayload.messages = [...updatedChatAgent.currentMessage];
    }

    updatedChatAgent.payload = secondPayload;
    //handleClientDisconnect(req, chat);
    // For the second call, we should use the non-streaming approach since we already have tool results
    //only for mete
    //need o fix the threadId not going back to the browse for the others
    // Increment recursion depth to prevent infinite loops
    await handleStream(updatedChatAgent, recursionDepth + 1);
    chatAgent.res.end();
    //sendSSEEvent(res, { type: 'done', thread_id: threadId });
  } else {
    // Ensure message is added if it wasn't added in response.completed or response.done
    // This handles cases where the stream ends without those events
    if (message && !chatAgent.currentMessage.some((msg: any) => msg.role === 'assistant' && !msg.tool_calls)) {
      console.log('xAI Streaming - Adding assistant message in else block (stream ended):', message);
      chatAgent.currentMessage.push({
        role: 'assistant',
        content: message, // Use string format to match OpenAI/chat completions format
      });
    } else if (!message) {
      console.log('xAI Streaming - No message accumulated, finalToolCalls.length:', finalToolCalls.length);
    }

    console.log('xAI Streaming - Final currentMessage before thread creation:', JSON.stringify(chatAgent.currentMessage, null, 2));

    chatAgent.threadId = await createThreadMessage(
      chatAgent.req,
      chatAgent.threadId,
      chatAgent.req.user.userId,
      chatAgent.currentMessage,
      chatAgent.req.user.userModel.settings,
      {},
      chatAgent.usage
    );
    sendSSEEvent(chatAgent.res, {
      type: 'done',
      thread_id: chatAgent.threadId,
      ...({ messages: chatAgent.currentMessage } as any), // Include full messages array for browser
    });
    console.log('xAI Streaming - Sent done event with messages:', JSON.stringify(chatAgent.currentMessage, null, 2));
    chatAgent.res.end();
  }
};
