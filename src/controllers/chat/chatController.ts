import OpenAI from 'openai';
import { Request, Response } from 'express';
import {
  setupSSEHeaders,
  sendSSEEvent,
  handleStreamingError,
} from '../../utils/streamingUtils';
import { AuthenticatedRequest, ChatAgent, ChatRequest } from '../../types';
import { createChatAgent } from '../../utils/agentUtils';
import { handleResponse } from './chatHandleResponse';
import { handleStream } from './chatHandleStream';
import {
  createPayload,
  configurePipedreamMCPServers,
  configureToolsFromMCPServers,
} from './chatUtils';

export const getChatAgents = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userModel } = (req as AuthenticatedRequest).user;
    const shouldStream = userModel?.settings?.config?.stream === true;
    let chatAgent = await createChatAgent(req as ChatRequest, res);
    const payload = await createPayload(req as AuthenticatedRequest);
    chatAgent.payload = { ...payload, ...chatAgent.payload };

    //get pipedream mcp servers
    if (
      userModel?.settings?.pipedream &&
      userModel.settings.pipedream.length > 0
    ) {
      chatAgent = await configurePipedreamMCPServers(
        userModel,
        req as ChatRequest,
        chatAgent
      );
    }

    if (
      userModel?.settings?.mcp_servers &&
      userModel.settings.mcp_servers.length > 0
    ) {
      chatAgent = await configureToolsFromMCPServers(
        userModel,
        req as ChatRequest,
        chatAgent
      );
    }

    chatAgent.api = null;
    switch (userModel?.model_id?.config?.url) {
      case 'https://api.aimlapi.com':
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.AIML_API_KEY!,
          baseURL: 'https://api.aimlapi.com',
        });
        break;
      case 'https://api.x.ai':
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.XAI_API_KEY!,
          baseURL: 'https://api.x.ai/v1',
          // timeout: 3600,
        });
        break;
      case 'https://api.deepseek.com':
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.DEEPSEEK_API_KEY!,
          baseURL: 'https://api.deepseek.com',
          //timeout: 360000,
        });
        break;
      case 'https://generativelanguage.googleapis.com/v1beta/openai/':
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.GEMINI_API_KEY!,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          // timeout: 360000,
        });
        break;
      case 'https://api.minimax.io/v1':
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.MINIMAX_API_KEY!,
          baseURL: 'https://api.minimax.io/v1',
          //timeout: 360000,
        });
        break;
      case 'https://router.huggingface.co/v1':
        console.log('Hugging Face API key:', chatAgent.apiKey);
        console.log('Hugging Face API key:', process.env.HUGGINGFACE_API_KEY);
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.HUGGINGFACE_API_KEY!,
          baseURL: 'https://router.huggingface.co/v1',
          //timeout: 360000,
        });
        break;
      default:
        chatAgent.api = new OpenAI({
          apiKey: chatAgent.apiKey || process.env.OPENAI_API_KEY!,
          baseURL: 'https://api.openai.com/v1',
        });
        break;
    }

    if (!shouldStream) {
      await handleResponse(chatAgent as ChatAgent);
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
    }

    res.end();
  } catch (error: any) {
    handleStreamingError(res, error, 'getOpenAIAgents');
    res.end();
  }
};
