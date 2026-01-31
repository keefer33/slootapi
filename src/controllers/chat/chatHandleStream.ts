import { ChatAgent } from '../../types';
import { sendSSEEvent } from '../../utils/streamingUtils';
import { getModelPricing } from '../utils/usage';
import { ToolCall } from '../../types';
import { handleToolCall } from './chatUtils';
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
    const inputMessages = chatAgent.payload.messages.map((msg: any) => {
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

          // Extract text from response.output if message is still empty
          if (!message && chunk.response?.output) {
            const textOutput = chunk.response.output.find(
              (output: any) => output.type === 'message' && output.content
            );
            if (textOutput?.content) {
              const textContent = textOutput.content.find(
                (content: any) => content.type === 'output_text'
              );
              if (textContent?.text) {
                message = textContent.text;
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
      // For responses endpoint with previous_response_id, we should only include
      // the tool results, not the assistant messages with tool_calls
      // The API will use previous_response_id to get the context
      const inputMessages = updatedChatAgent.currentMessage
        .filter((msg: any) => {
          // Exclude assistant messages with tool_calls - they're handled via previous_response_id
          if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
            return false;
          }
          return true;
        })
        .map((msg: any) => {
          // Handle tool results - responses endpoint expects specific format
          // Note: 'name' field is only allowed for 'user' messages, not 'tool' messages
          if (msg.role === 'tool') {
            return {
              role: 'tool',
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              tool_call_id: msg.tool_call_id || msg.call_id,
              // Do not include 'name' field - it's only allowed for user messages
            };
          }

        if (msg.content && Array.isArray(msg.content)) {
          return {
            role: msg.role,
            content: msg.content.map((contentItem: any) => {
              if (msg.role === 'user') {
                if (contentItem.type === 'text') {
                  return {
                    type: 'input_text',
                    text: contentItem.text || '',
                  };
                }
              } else if (msg.role === 'assistant') {
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
        // For other message types, keep as-is
        return msg;
      });
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
    // Ensure message is added if it wasn't added in response.done
    if (message && !chatAgent.currentMessage.some((msg: any) => msg.role === 'assistant')) {
      console.log('xAI Streaming - Adding assistant message in else block:', message);
      chatAgent.currentMessage.push({
        role: 'assistant',
        content: message, // Use string format to match OpenAI/chat completions format
      });
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
