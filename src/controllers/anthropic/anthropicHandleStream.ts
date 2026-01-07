import { ChatAgent } from '../../types';
import { sendSSEEvent, setupSSEHeaders } from '../../utils/streamingUtils';
import { getModelPricing } from '../utils/usage';
import { handleToolCall, handleMCPCall } from './anthropicUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

// Function to handle streaming with tool calls
export const handleStream = async (chatAgent: ChatAgent): Promise<void> => {

  const anthropicConnection = await chatAgent.anthropic!.beta.messages.stream(
    chatAgent.payload
  );

  // Send immediate connection confirmation
  let endOfStream = false;
  let updateStatus = 'Stream created';
  for await (const chunk of anthropicConnection) {
    sendSSEEvent(chatAgent.res, {
      type: 'updates',
      text: { type: 'in_progress', status: updateStatus },
      thread_id: chatAgent.threadId || '',
    });
    if (!endOfStream) {
      switch (chunk.type) {
        case 'message_start':
          updateStatus = 'Message start: ' + chunk.message?.role ||
          +' ' + chunk.message?.model ||
          '';
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: updateStatus,
            },
            thread_id: chatAgent.threadId || '',
          });
          break;

        case 'content_block_start':
          let contentBlockType = chunk.content_block?.type;
          let contentBlock;
          if (contentBlockType === 'text') {
            contentBlock = 'text';
          }
          if (contentBlockType === 'thinking') {
            contentBlock = 'thinking';
          }
          if (contentBlockType === 'redacted_thinking') {
            contentBlock = 'redacted thinking';
          }
          if (contentBlockType === 'tool_use') {
            contentBlock = 'tool use ' + (chunk.content_block as any)?.name;
          }
          if (contentBlockType === 'server_tool_use') {
            contentBlock = 'server tool use';
          }
          if (contentBlockType === 'web_search_tool_result') {
            contentBlock = 'web search tool result';
          }
          if (contentBlockType === 'code_execution_tool_result') {
            contentBlock = 'code execution tool result';
          }
          if (contentBlockType === 'mcp_tool_use') {
            contentBlock = 'mcp tool use ' + (chunk.content_block as any)?.name;
          }
          if (contentBlockType === 'mcp_tool_result') {
            contentBlock = 'mcp tool result';
          }
          if (contentBlockType === 'container_upload') {
            contentBlock = 'container upload';
          }
          updateStatus = 'Content block: ' + contentBlock;
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: updateStatus,
            },
            thread_id: chatAgent.threadId || '',
          });
          break;

        case 'content_block_delta':
          if ((chunk.delta as any).type === 'text_delta') {
            updateStatus = 'Text delta';
            sendSSEEvent(chatAgent.res, {
              type: 'updates',
              text: {
                type: 'in_progress',
                status: updateStatus,
              },
              thread_id: chatAgent.threadId || '',
            });
            sendSSEEvent(chatAgent.res, {
              type: 'text',
              text: (chunk.delta as any).text,
              thread_id: chatAgent.threadId || '',
            });
          }
          break;
        /*
        case 'content_block_stop':
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: 'Content block stop'
            },
            thread_id: chatAgent.threadId || '',
          });
          break;

      case 'message_delta':
        if ((chunk.delta as any).stop_reason === 'end_turn') {
          endOfStream = true;
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: 'Stream In Progress: end of turn',
            },
            thread_id: chatAgent.threadId || '',
          });
        } else {
          sendSSEEvent(chatAgent.res, {
            type: 'updates',
            text: {
              type: 'in_progress',
              status: 'Stream In Progress: ' + chunk.type || '',
            },
            thread_id: chatAgent.threadId || '',
          });
        }
        break;
        */
      }
    }
  }

  const firstMessage = await anthropicConnection.finalMessage();
  chatAgent.currentMessage.push({
    role: firstMessage.role,
    content: firstMessage.content,
  });
  const usage = getModelPricing(
    firstMessage.usage as any,
    chatAgent.req.user.userModel
  );
  chatAgent.usage.push(usage);

  const updatedChatAgent = await handleMCPCall(firstMessage.content, chatAgent);

  const toolUseBlocks = firstMessage.content.filter(
    (block: any) => block.type === 'tool_use'
  );

  if (toolUseBlocks.length === 0) {
    updatedChatAgent.threadId = await createThreadMessage(
      updatedChatAgent.req,
      updatedChatAgent.threadId,
      updatedChatAgent.req.user.userId,
      updatedChatAgent.currentMessage,
      updatedChatAgent.req.user.userModel.settings,
      '',
      updatedChatAgent.usage
    );
    sendSSEEvent(updatedChatAgent.res, {
      type: 'done',
      thread_id: updatedChatAgent.threadId,
    });
    return;
  } else {
    const toolCalls = toolUseBlocks.map((block: any) => ({
      id: block.id,
      name: block.name,
      input: block.input,
      type: 'tool_use',
    }));
    const updatedChatAgentWithTools = await handleToolCall(
      toolCalls,
      updatedChatAgent
    );
    const secondPayload = {
      ...updatedChatAgentWithTools.payload,
      messages: updatedChatAgentWithTools.currentMessage,
    };
    updatedChatAgentWithTools.payload = secondPayload;
    return await handleStream(updatedChatAgentWithTools);
  }
};
