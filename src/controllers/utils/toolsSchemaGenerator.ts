import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Type definitions
interface ToolsSchemaRequest {
  action: 'initialize' | 'continue';
  prompt?: string;
  message?: string;
  responseId?: string;
  toolId?: string;
}

interface ToolsSchemaResponse {
  success: boolean;
  responseId?: string | undefined;
  message?: string | undefined;
  schema?: string | undefined;
  error?: string | undefined;
}

interface MCPSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
      }
    >;
    required: string[];
  };
}

interface OpenAIResponse {
  id: string;
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  formatted_results?: string[];
}

interface ToolCall {
  id: string;
  type: string;
  // Add other properties as needed
}

const toolsSchemaGenerator = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { action, prompt, message, responseId, toolId }: ToolsSchemaRequest =
      req.body;

    if (!(req as AuthenticatedRequest).user?.userId) {
      const errorResponse: ToolsSchemaResponse = {
        success: false,
        error: 'User ID is required',
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Initialize Supabase client
    const supabase: SupabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === 'initialize') {
      await handleInitialize(
        req as AuthenticatedRequest,
        res,
        prompt!,
        toolId,
        (req as AuthenticatedRequest).user.userId,
        supabase
      );
    } else if (action === 'continue') {
      await handleContinue(
        req as AuthenticatedRequest,
        res,
        message!,
        responseId!
      );
    } else {
      const errorResponse: ToolsSchemaResponse = {
        success: false,
        error: 'Invalid action',
      };
      res.status(400).json(errorResponse);
    }
  } catch (error: any) {
    console.error('Error in handleToolSchemaGeneration:', error);
    const errorResponse: ToolsSchemaResponse = {
      success: false,
      error: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

async function handleInitialize(
  req: AuthenticatedRequest,
  res: Response,
  prompt: string,
  _toolId: string | undefined,
  _userId: string,
  _supabase: SupabaseClient
): Promise<void> {
  try {
    const systemPrompt = `You are an expert AI assistant helping to generate MCP (Model Context Protocol) function schemas from API documentation.

Your task is to help the user create a valid MCP function schema based on their requirements. You should:

1. Ask clarifying questions to understand their needs
2. Use web search tools to find information about APIs or services when needed
3. Generate appropriate JSON schemas for MCP functions
4. Be conversational and helpful throughout the process

When you're ready to generate the final schema, use this exact format:
SCHEMA_GENERATED:
\`\`\`json
{
  "name": "functionName",
  "description": "A clear description of what this function does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "parameter_name": {
        "type": "parameter_type",
        "description": "Parameter description"
      }
    },
    "required": ["required_parameter1"]
  }
}
\`\`\`

CRITICAL GUIDELINES:
1. Create a descriptive function name based on the API endpoint
2. Write a clear description of what the function does
3. Identify all API parameters and convert them to JSON Schema format
4. Use appropriate types (string, integer, boolean, number)
5. Add detailed descriptions for each parameter
6. Include default values in descriptions when mentioned in the API docs
7. Mark required parameters in the "required" array
8. For enum values: USE THE EXACT VALUES PROVIDED IN THE DOCUMENTATION - DO NOT MODIFY, CLEAN UP, OR STANDARDIZE THEM
9. Preserve all special characters, slashes, dashes, and formatting in enum values
10. Return ONLY the JSON schema, no explanations or markdown

Be conversational and helpful. Ask questions to understand their requirements better. Use web search when you need to find information about APIs, documentation, or services.`;

    const response: OpenAIResponse = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: `${systemPrompt}\n\nUser: ${prompt}`,
      tools: [
        {
          type: 'web_search_preview',
        },
      ],
    });

    const aiResponse = await extractTextFromResponse(response);

    // Extract structured output from response
    let generatedSchema: string | null = null;
    try {
      // Try to parse the response as JSON directly
      const parsedResponse: MCPSchema = JSON.parse(aiResponse);
      if (
        parsedResponse &&
        typeof parsedResponse === 'object' &&
        'name' in parsedResponse &&
        'description' in parsedResponse &&
        'inputSchema' in parsedResponse
      ) {
        generatedSchema = JSON.stringify(parsedResponse, null, 2);
      }
    } catch (error) {
      // Fallback to JSON extraction from text response
      console.error('JSON parse error:', error);
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedSchema: MCPSchema = JSON.parse(jsonMatch[0]);
          if (
            parsedSchema.name &&
            parsedSchema.description &&
            parsedSchema.inputSchema
          ) {
            generatedSchema = JSON.stringify(parsedSchema, null, 2);
          }
        }
      } catch (error) {
        console.log('JSON parse error:', error);
        // Schema parsing failed
      }
    }

    const successResponse: ToolsSchemaResponse = {
      success: true,
      responseId: response.id,
      message: aiResponse,
      schema: generatedSchema || undefined,
    };
    res.json(successResponse);
  } catch (error: any) {
    console.error('Error in handleInitialize:', error);
    const errorResponse: ToolsSchemaResponse = {
      success: false,
      error: error.message,
    };
    res.status(500).json(errorResponse);
  }
}

async function handleContinue(
  req: AuthenticatedRequest,
  res: Response,
  message: string,
  responseId: string
): Promise<void> {
  try {
    // First, check if there are any pending tool calls in the previous response
    const previousResponse: OpenAIResponse =
      await openai.responses.retrieve(responseId);

    // Check if there are any pending tool calls that need to be resolved
    const pendingToolCalls: ToolCall[] =
      await processToolCalls(previousResponse);

    let currentResponseId = responseId;

    // If there were pending tool calls, submit the tool outputs first
    if (pendingToolCalls.length > 0) {
      // For now, skip tool call processing as web search is handled automatically
      // This would need to be implemented based on the actual tool call structure
      console.log('Tool calls detected but not processed:', pendingToolCalls);
    }

    // Now continue the conversation with the user's message
    const response: OpenAIResponse = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: message,
      previous_response_id: currentResponseId,
      tools: [
        {
          type: 'web_search_preview',
        },
      ],
    });

    // Check if there are any new tool calls that need to be processed
    const newToolCalls: ToolCall[] = await processToolCalls(response);

    let finalResponseId = response.id;
    let finalResponse = await extractTextFromResponse(response);

    // If there were new tool calls, submit the tool outputs
    if (newToolCalls.length > 0) {
      // For now, skip tool call processing as web search is handled automatically
      // This would need to be implemented based on the actual tool call structure
      console.log('New tool calls detected but not processed:', newToolCalls);
    }

    // Extract structured output from response
    let generatedSchema: string | null = null;
    try {
      // Try to parse the response as JSON directly
      const parsedResponse: MCPSchema = JSON.parse(finalResponse);
      if (
        parsedResponse &&
        typeof parsedResponse === 'object' &&
        'name' in parsedResponse &&
        'description' in parsedResponse &&
        'inputSchema' in parsedResponse
      ) {
        generatedSchema = JSON.stringify(parsedResponse, null, 2);
      }
    } catch (error) {
      console.log('JSON parse error:', error);
      // Fallback to JSON extraction from text response
      try {
        const jsonMatch = finalResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedSchema: MCPSchema = JSON.parse(jsonMatch[0]);
          if (
            parsedSchema.name &&
            parsedSchema.description &&
            parsedSchema.inputSchema
          ) {
            generatedSchema = JSON.stringify(parsedSchema, null, 2);
          }
        }
      } catch {
        // Schema parsing failed
      }
    }

    const successResponse: ToolsSchemaResponse = {
      success: true,
      responseId: finalResponseId,
      message: finalResponse,
      schema: generatedSchema || undefined,
    };
    res.json(successResponse);
  } catch (error: any) {
    console.error('Error in handleContinue:', error);
    const errorResponse: ToolsSchemaResponse = {
      success: false,
      error: 'Failed to continue conversation',
    };
    res.status(500).json(errorResponse);
  }
}

async function processToolCalls(response: OpenAIResponse): Promise<ToolCall[]> {
  const toolOutputs: ToolCall[] = [];

  if (response.output && Array.isArray(response.output)) {
    for (const output of response.output) {
      if (output.type === 'web_search_call') {
        // Web search calls are handled automatically by OpenAI
        // We don't need to process them manually
        // For now, return empty array as web search is handled automatically
      }
    }
  }

  return toolOutputs;
}

async function extractTextFromResponse(
  response: OpenAIResponse
): Promise<string> {
  // Use the formatted results if available, otherwise fall back to raw output
  if (response.formatted_results && response.formatted_results.length > 0) {
    return response.formatted_results[0] || '';
  }

  // Fallback to raw output extraction
  let aiResponse = '';

  if (response.output && Array.isArray(response.output)) {
    for (const output of response.output) {
      if (
        output.type === 'message' &&
        output.content &&
        Array.isArray(output.content)
      ) {
        for (const content of output.content) {
          if (content.type === 'output_text') {
            aiResponse += content.text || '';
          }
        }
      }
    }
  }

  return aiResponse;
}

export default toolsSchemaGenerator;
