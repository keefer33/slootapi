import Anthropic from '@anthropic-ai/sdk';
import { Request, Response } from 'express';
import {
  setupSSEHeaders,
  sendSSEEvent,
  handleStreamingError,
} from '../../utils/streamingUtils';
import {
  AuthenticatedRequest,
  ChatAgent,
  AnthropicResponse,
  ChatRequest,
} from '../../types';
import { createChatAgent } from '../../utils/agentUtils';
import { handleStream } from './anthropicHandleStream';
import { handleResponse } from './anthropicHandleResponse';
import { createPayload } from './anthropicUtils';

export const getAnthropicAgents = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userModel } = (req as AuthenticatedRequest).user;
    const shouldStream = userModel?.settings?.config?.stream === true;
    const chatAgent = await createChatAgent(req as ChatRequest, res);
    const payload = await createPayload(req as AuthenticatedRequest);
    chatAgent.payload = { ...payload, ...chatAgent.payload };
    const anthropicApiKey = chatAgent.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      const errorMsg = 'Anthropic API key not found in environment variables';
      if (shouldStream) {
        sendSSEEvent(res, {
          type: 'error',
          text: errorMsg,
          thread_id: chatAgent.threadId || '',
        });
        res.end();
        return;
      } else {
        const errorResponse: AnthropicResponse = {
          success: false,
          error: 'Configuration error',
          message: errorMsg,
        };
        res.status(500).json(errorResponse);
        return;
      }
    }

    chatAgent.anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    if (!shouldStream) {
      const response = await handleResponse(chatAgent as ChatAgent);
      const successResponse: AnthropicResponse = {
        success: true,
        thread_id: response.thread_id,
        ...response.anthropicConnection,
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
      // Handle streaming response
      // Small delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 200));
      await handleStream(chatAgent);
      res.end();
    }

    res.end();
  } catch (error: any) {
    handleStreamingError(res, error, 'getAnthropicAgents');
    res.end();
  }
};
