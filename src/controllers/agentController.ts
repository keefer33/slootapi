import { Request, Response } from 'express';
import { getAnthropicAgents } from './anthropic/anthropicController';
import { getOpenAIAgents } from './openai/openaiController';
import { AuthenticatedRequest } from '../types';
import { getChatAgents } from './chat/chatController';

interface AgentResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      model_id: string;
    };
    agents: any[];
    message: string;
  };
  error?: string;
  message?: string;
}

const loadAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userModel } = (req as AuthenticatedRequest).user;
    if (userModel?.model_id?.config?.api === 'chat') {
      await getChatAgents(req, res);
      return;
    } else {
      switch (userModel?.model_id?.brand_id?.slug) {
        case 'anthropic':
          await getAnthropicAgents(req, res);
          return;
        case 'openai':
          await getOpenAIAgents(req, res);
          return;
        default:
          const errorResponse: AgentResponse = {
            success: false,
            error: 'Invalid brand',
            message: 'The provided brand is not valid',
          };
          res.status(400).json(errorResponse);
          return;
      }
    }
  } catch (error: any) {
    console.error('Error in loadAgent:', error);
    const errorResponse: AgentResponse = {
      success: false,
      error: 'Internal server error',
      message: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

export { loadAgent };
