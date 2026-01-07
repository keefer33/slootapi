import OpenAI from 'openai';
import { Request, Response } from 'express';
import {
  setupSSEHeaders,
  sendSSEEvent,
  handleStreamingError,
} from '../../utils/streamingUtils';
import {
  AuthenticatedRequest,
  ChatAgent,
  OpenAIResponse,
  ChatRequest,
} from '../../types';
import { createChatAgent } from '../../utils/agentUtils';
import { handleStream } from './openaiHandleStream';
import { handleResponse } from './openaiHandleResponse';
import { createPayload } from './openaiUtils';

export const getOpenAIAgents = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userModel } = (req as AuthenticatedRequest).user;
    const shouldStream = userModel?.settings?.config?.stream === true;
    const chatAgent = await createChatAgent(req as ChatRequest, res);
    const payload = await createPayload(req as AuthenticatedRequest);
    chatAgent.payload = { ...payload, ...chatAgent.payload };
    //turning off previous_response_id for now because it's not working
    /*
    if (chatAgent.threadId) {
      const lastMessage = await getLastThreadMessage(
        chatAgent.threadId,
        req.user.userId
      );
      previous_response_id = lastMessage.extra.previous_response_id;
    } else {
      thread = await createThread(
        req.user.userId,
        req.body.prompt,
        userModel.id
      );
      chatAgent.threadId = thread.id;
    }
          if (previous_response_id) {
      chatAgent.payload.previous_response_id = previous_response_id;
    }
      */

    const openaiApiKey = chatAgent.apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      const errorMsg = 'OpenAI API key not found in environment variables';
      const errorResponse: OpenAIResponse = {
        success: false,
        error: 'Configuration error',
        message: errorMsg,
      };
      res.status(500).json(errorResponse);
      return;
    }

    chatAgent.api = new OpenAI({ apiKey: openaiApiKey }) as OpenAI;
    if (!shouldStream) {
      const response = await handleResponse(chatAgent as ChatAgent);
      const { success, thread_id, ...restResponse } = response;
      const successResponse: OpenAIResponse = {
        success: true,
        thread_id: chatAgent.threadId || undefined,
        ...restResponse,
      };
      res.status(200).json(successResponse);
      return;
    } else {
      setupSSEHeaders(res);
      sendSSEEvent(res, { type: 'connection', status: 'established' });
      sendSSEEvent(res, {
        type: 'updates',
        text: {
          type: 'in_progress',
          status: 'Stream connected successfully',
        },
        thread_id: chatAgent.threadId || '',
      });

      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 200));

      await handleStream(chatAgent as ChatAgent);
      res.end();
    }

    res.end();
  } catch (error: any) {
    handleStreamingError(res, error, 'getOpenAIAgents');
    res.end();
    return;
  }
};
