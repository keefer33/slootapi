import { ChatAgent, ChatResponse } from '../../types';
import { getModelPricing } from '../utils/usage';
import { handleToolCall } from './chatUtils';
import { ToolCall } from '../../types';
import { createThreadMessage } from '../../utils/threadsUtils';

export const handleResponse = async (chatAgent: ChatAgent): Promise<void> => {
  const response = await chatAgent.api!.chat.completions.create(
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
    chatAgent.currentMessage.push({
      ...response.choices?.[0]?.message,
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
};

const t = {}
