import { ChatAgent } from '../../types';
import { getModelPricing } from '../utils/usage';
import { handleToolCall, handleMCPCall } from './anthropicUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

export const handleResponse = async (
    chatAgent: ChatAgent
  ): Promise<{ anthropicConnection: any; thread_id: string | null }> => {
    // Handle non-streaming response
    const anthropicConnection = await chatAgent.anthropic!.beta.messages.create(
      chatAgent.payload
    );
    chatAgent.currentMessage.push({
      role: anthropicConnection.role,
      content: anthropicConnection.content,
    });
    const usage = getModelPricing(
      anthropicConnection.usage as any,
      chatAgent.req.user.userModel
    );
    chatAgent.usage.push(usage);

    const updatedChatAgent = await handleMCPCall(
      anthropicConnection.content,
      chatAgent
    );

    // Check if tool use is required
    if (anthropicConnection.stop_reason === 'tool_use') {
      // Extract tool calls from the response
      const toolCalls = anthropicConnection.content
        .filter((content: any) => content.type === 'tool_use')
        .map((toolUse: any) => ({
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
          type: 'tool_use',
        }));

      const updatedChatAgentWithTools = await handleToolCall(
        toolCalls,
        updatedChatAgent
      );

      // Make second call with tool results
      const secondPayload = {
        ...updatedChatAgentWithTools.payload,
        messages: updatedChatAgentWithTools.currentMessage,
      };
      updatedChatAgentWithTools.payload = secondPayload;
      return await handleResponse(updatedChatAgentWithTools);
    } else {
      updatedChatAgent.threadId = await createThreadMessage(
        updatedChatAgent.req,
        updatedChatAgent.threadId,
        updatedChatAgent.req.user.userId,
        updatedChatAgent.currentMessage,
        updatedChatAgent.req.user.userModel.settings,
        '',
        updatedChatAgent.usage
      );
      return {
        anthropicConnection,
        thread_id: updatedChatAgent.threadId,
      };
    }
  };
