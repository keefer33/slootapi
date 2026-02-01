import { ChatAgent } from '../../types';
import { sendSSEEvent } from '../../utils/streamingUtils';
import { getModelPricing } from '../utils/usage';
import { handleToolCall, handleMCPCall } from './openaiUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

// Function to handle the first stream and collect tool results
export const handleStream = async (chatAgent: ChatAgent): Promise<void> => {
  delete chatAgent.payload.previous_response_id;

  let stream;
  try {
    stream = await chatAgent.api!.responses.create(chatAgent.payload);
  } catch (error: any) {
    // Handle MCP server validation errors from OpenAI
    if (error?.error?.type === 'external_connector_error' || error?.code === 'http_error') {
      const errorMessage = error?.error?.message || error?.message || 'Unknown error';
      console.error('OpenAI MCP server validation error:', errorMessage);

      // Check if it's an MCP server error
      if (errorMessage.includes('MCP server') || errorMessage.includes('404')) {
        sendSSEEvent(chatAgent.res, {
          type: 'error',
          text: `MCP server connection error: ${errorMessage}. Please check that all MCP servers are accessible.`,
          thread_id: chatAgent.threadId || '',
        });
        chatAgent.res.end();
        return;
      }
    }
    // Re-throw other errors
    throw error;
  }

  //let previous_response_id = undefined;
  const finalToolCalls: any[] = [];
  let updateStatus = 'Response created';

  try {
    for await (const chunk of stream as any) {
    sendSSEEvent(chatAgent.res, {
      type: 'updates',
      text: { type: 'in_progress', status: updateStatus },
      thread_id: chatAgent.threadId || '',
    });

    switch (chunk.type) {
      case 'response.created':
        chatAgent.payload.previous_response_id = chunk.response?.id;
        updateStatus = 'Response created';
        sendSSEEvent(chatAgent.res, {
          type: 'updates',
          text: { type: 'in_progress', status: updateStatus },
          thread_id: chatAgent.threadId || '',
        });

        break;
      case 'response.in_progress':
        updateStatus = 'In progress';
        sendSSEEvent(chatAgent.res, {
          type: 'updates',
          text: { type: 'in_progress', status: updateStatus },
          thread_id: chatAgent.threadId || '',
        });
        break;
      case 'response.output_item.added':
        if (chunk.item?.type === 'function_call') {
          finalToolCalls[chunk.output_index || 0] = chunk.item;
        }
        let chunkItemOutput = chunk.item?.type;
        if (chunk.item?.name) {
          chunkItemOutput += ' ' + chunk.item?.name;
        }
        updateStatus = 'Output item added: ' + chunkItemOutput;
        sendSSEEvent(chatAgent.res, {
          type: 'updates',
          text: {
            type: 'in_progress',
            status: updateStatus,
          },
          thread_id: chatAgent.threadId || '',
        });

        break;
      case 'response.output_item.done':
        let chunkItemOutputDone = chunk.item?.type;
        if (chunk.item?.name) {
          chunkItemOutputDone += ' ' + chunk.item?.name;
        }
        updateStatus = 'Output item done: ' + chunkItemOutputDone;
        sendSSEEvent(chatAgent.res, {
          type: 'updates',
          text: {
            type: 'in_progress',
            status: updateStatus,
          },
          thread_id: chatAgent.threadId || '',
        });
        break;
      case 'response.output_text.delta':
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
          text: chunk.delta || '',
          thread_id: chatAgent.threadId || '',
        });
        break;

      case 'response.function_call_arguments.delta':
        if (finalToolCalls[chunk.output_index || 0]) {
          finalToolCalls[chunk.output_index || 0].arguments +=
            chunk.delta || '';
        }
        break;
    }

    if (chunk.type === 'response.completed') {
      //chatAgent.payload.previous_response_id = chunk.response.id;
      chatAgent.currentMessage.push(...(chunk.response?.output || []));
      const usage = getModelPricing(
        chunk.response?.usage as any,
        chatAgent.req.user.userModel
      );
      chatAgent.usage.push(usage);
      chatAgent = handleMCPCall(chunk.response?.output, chatAgent);
      break;
    }
  }
  } catch (error: any) {
    // Handle errors during stream iteration (e.g., MCP server validation errors)
    if (error?.error?.type === 'external_connector_error' || error?.code === 'http_error') {
      const errorMessage = error?.error?.message || error?.message || 'Unknown error';
      console.error('OpenAI stream error (MCP server):', errorMessage);

      // Check if it's an MCP server error
      if (errorMessage.includes('MCP server') || errorMessage.includes('404')) {
        sendSSEEvent(chatAgent.res, {
          type: 'error',
          text: `MCP server connection error: ${errorMessage}. The MCP server may be unavailable. Please check your MCP server configuration.`,
          thread_id: chatAgent.threadId || '',
        });
        chatAgent.res.end();
        return;
      }
    }
    // Re-throw other errors
    throw error;
  }

  if (finalToolCalls.length > 0) {
    const toolCalls = finalToolCalls.filter(
      (toolCall: any) => toolCall?.type === 'function_call'
    );

    const updatedChatAgentWithTools = await handleToolCall(
      toolCalls,
      chatAgent
    );

    const secondPayload = {
      ...updatedChatAgentWithTools.payload,
      input: [...updatedChatAgentWithTools.currentMessage],
    };
    updatedChatAgentWithTools.payload = secondPayload;
    return await handleStream(updatedChatAgentWithTools);
  } else {
    chatAgent.threadId = await createThreadMessage(
      chatAgent.req,
      chatAgent.threadId,
      chatAgent.req.user.userId,
      chatAgent.currentMessage,
      chatAgent.req.user.userModel.settings,
      {
        previous_response_id: chatAgent.payload.previous_response_id,
      },
      chatAgent.usage
    );
    sendSSEEvent(chatAgent.res, {
      type: 'done',
      thread_id: chatAgent.threadId,
    });
    chatAgent.res.end();
  }
};
