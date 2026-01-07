import { Request, Response } from 'express';

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ErrorResponse {
  error: string;
  details?: any;
}

const chatCompletions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { model, messages, temperature, max_tokens }: ChatCompletionRequest =
      req.body;

    if (!model || !messages) {
      const errorResponse: ErrorResponse = {
        error: 'Missing required fields: model and messages',
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Get OpenAI API key from environment or user settings
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      const errorResponse: ErrorResponse = {
        error: 'OpenAI API key not configured',
      };
      res.status(500).json(errorResponse);
      return;
    }

    // Prepare the request to OpenAI
    const openaiRequest = {
      model,
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000,
      stream: false,
    };

    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      const errorResponse: ErrorResponse = {
        error: `OpenAI API error: ${response.status} ${response.statusText}`,
        details: errorData,
      };
      res.status(response.status).json(errorResponse);
      return;
    }

    const result = (await response.json()) as ChatCompletionResponse;
    res.json(result);
  } catch (error: any) {
    console.error('Error in OpenAI API action:', error);
    const errorResponse: ErrorResponse = {
      error: 'Internal server error',
      details: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

export default chatCompletions;
