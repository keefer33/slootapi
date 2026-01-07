import { ChatAgent } from '../../types';
import { getModelPricing } from '../utils/usage';
import { handleToolCall, handleMCPCall } from './openaiUtils';
import { createThreadMessage } from '../../utils/threadsUtils';

export const handleResponse = async (
    chatAgent: ChatAgent
  ): Promise<{
    success: boolean;
    thread_id: string | null;
    [key: string]: any;
  }> => {
    delete chatAgent.payload.previous_response_id;

    const response = await chatAgent.api!.responses.create(chatAgent.payload);
    chatAgent.currentMessage.push(...response.output);
    const usage = getModelPricing(
      response.usage as any,
      chatAgent.req.user.userModel
    );
    chatAgent.usage.push(usage);

    const updatedChatAgent = handleMCPCall(response.output, chatAgent);

    //call the functions for the tool calls
    const toolCalls = response.output
      .filter((output: any) => output.type === 'function_call')
      .map((output: any) => ({
        type: output.type,
        name: output.name,
        arguments: output.arguments,
        call_id: output.call_id,
      }));
    if (toolCalls.length > 0) {
      const updatedChatAgentWithTools = await handleToolCall(
        toolCalls,
        updatedChatAgent
      );
      //add to payload and make a second call

      /*
      const secondPayload = {
        ...updatedChatAgentWithTools.payload,
        previous_response_id: response.id,
      };
      */

      const secondPayload = {
        ...updatedChatAgentWithTools.payload,
        input: [...updatedChatAgentWithTools.currentMessage],
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
        {
          previous_response_id: response.id,
        },
        updatedChatAgent.usage
      );
      return {
        success: true,
        thread_id: updatedChatAgent.threadId,
        ...response,
      };
    }
  };
