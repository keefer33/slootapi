import { ChatAgent } from '../../types';
import { sendSSEEvent } from '../../utils/streamingUtils';
import { getModelPricing } from '../utils/usage';
import { ToolCall } from '../../types';
import { handleToolCall } from './chatUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

// Function to handle the first stream and collect tool results
export const handleStream = async (chatAgent: ChatAgent): Promise<any> => {
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
  const chat = await chatAgent.api!.chat.completions.stream(chatAgent.payload);
  let updateStatus = 'Message in progress';
  for await (const chunk of chat) {

    sendSSEEvent(chatAgent.res, {
      type: 'updates',
      text: { type: 'in_progress', status: updateStatus },
      thread_id: chatAgent.threadId || '',
    });
    if (chunk?.choices[0]?.delta?.content) {
      message += chunk?.choices[0]?.delta?.content;
      sendSSEEvent(chatAgent.res, {
        type: 'text',
        text: chunk?.choices[0]?.delta?.content,
        thread_id: chatAgent.threadId || '',
      });
      updateStatus = 'Message in progress';
      sendSSEEvent(chatAgent.res, {
        type: 'updates',
        text: {
          type: 'in_progress',
          status: updateStatus,
        },
        thread_id: chatAgent.threadId || '',
      });
    }

    if (chunk?.choices[0]?.delta?.tool_calls) {
      updateStatus = 'Tool calls in progress';
      sendSSEEvent(chatAgent.res, {
        type: 'updates',
        text: {
          type: 'in_progress',
          status: updateStatus,
        },
        thread_id: chatAgent.threadId || '',
      });
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
      chatAgent.currentMessage.push({ role: 'assistant', content: message });
    }

    if (chunk?.usage) {
      const usage = getModelPricing(chunk.usage, chatAgent.req.user.userModel);
      chatAgent.usage.push(usage);
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

    const secondPayload = {
      ...updatedChatAgent.payload,
      messages: [...updatedChatAgent.currentMessage],
    };
    updatedChatAgent.payload = secondPayload;
    //handleClientDisconnect(req, chat);
    // For the second call, we should use the non-streaming approach since we already have tool results
    //only for mete
    //need o fix the threadId not going back to the browse for the others
    await handleStream(updatedChatAgent);
    chatAgent.res.end();
    //sendSSEEvent(res, { type: 'done', thread_id: threadId });
  } else {
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
    });
    chatAgent.res.end();
  }
};
