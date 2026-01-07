import { Anthropic } from '@anthropic-ai/sdk';
import { Request, Response, NextFunction } from 'express';
import { OpenAI } from 'openai';

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  userId: string;
  token: string;
  userModel: UserModel;
  userProfile: UserProfile;
}

export interface UserProfile {
  balance: number;
  currency: string;
}

export interface UserModel {
  id: string;
  settings: ModelSettings;
  model_id: ModelId;
  apikey?: string | { key: string } | null;
}

export interface ModelId {
  id: string;
  model: string;
  config: ModelConfig;
  brand_id: BrandId;
}

export interface BrandId {
  id: string;
  slug: string;
  name: string;
}

export interface ModelConfig {
  api: string;
  model_name: string;
  url?: string;
}

export interface ModelSettings {
  config: {
    stream?: boolean;
    instructions?: string;
    [key: string]: any;
  };
  tools?: string[];
  mcp_servers?: string[];
  builtInTools?: {
    web_search_parameters?: WebSearchParameters;
    web_search_preview?: WebSearchPreview;
    search_parameters?: SearchParameters;
  };
  pipedream?: PipedreamTool[];
  optionalFields?: OptionalField[];
}

export interface WebSearchParameters {
  enabled: boolean;
  max_uses?: number;
  allowed_domains?: string[];
  blocked_domains?: string[];
  user_location?: UserLocation;
}

export interface WebSearchPreview {
  enabled: boolean;
  [key: string]: any;
}

export interface SearchParameters {
  [key: string]: any;
}

export interface UserLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface PipedreamTool {
  name: string;
  url: string;
}

export interface OptionalField {
  json_payload?: string;
  [key: string]: any;
}

// Request/Response Types
export interface AuthenticatedRequest extends Request {
  user: User;
  userProfile: UserProfile;
}

export interface ChatRequest extends AuthenticatedRequest {
  body: {
    agent_id: string;
    prompt: string;
    thread_id?: string;
    files?: FileInput[];
  };
}

export interface FileInput {
  url: string;
  type: string;
}

// Tool Types
export interface Tool {
  id: string;
  tool_name: string;
  schema: ToolSchema;
  avatar?: string;
  is_admin: boolean;
  is_pipedream: boolean;
  is_sloot: boolean;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AttachedTool {
  id: string;
  user_model_id: string;
  user_tool_id: string;
  created_at: string;
  tool: Tool;
}

export interface ToolCallResult {
  type?: 'function_call_output' | 'tool_call_result' | 'tool_result';
  call_id?: string | undefined;
  output?: string | undefined;
  role?: string | undefined;
  content?: string | undefined;
  tool_call_id?: string | undefined;
  name?: string | undefined;
  tool_use_id?: string | undefined;
}

// MCP Server Types
export interface MCPServer {
  id: string;
  server_name: string;
  server_url: string;
  type: 'connect' | 'public' | 'private';
  auth_token?: string;
}

export interface ConfiguredMCPServer {
  type: 'url' | 'mcp';
  url?: string;
  name?: string;
  server_url?: string;
  server_label?: string;
  require_approval?: string;
  authorization_token?: string;
  headers?: Record<string, string>;
}

// Chat Agent Types
export interface ChatAgent {
  currentMessage: any[];
  usage: any[];
  threadId: string | null;
  payload: any;
  api?: any; // Flexible API type for different providers
  anthropic?: Anthropic | null;
  openai?: OpenAI | null;
  res: Response;
  req: AuthenticatedRequest;
  mcpServers?: ConfiguredMCPServer[] | any;
  apiKey?: string | null;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentItem[];
}

export interface ContentItem {
  type: 'input_text' | 'input_image' | 'input_file' | 'text';
  text?: string;
  image_url?: string | { url: string };
  file_url?: string | { url: string };
}

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  thread_id?: string;
}

// Express Middleware Types
export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;
export type ValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// Database Types
export interface DatabaseClient {
  supabase: any;
}

// Streaming Types
export interface SSEEvent {
  type: string;
  text?: string | any;
  thread_id?: string;
  status?: string;
}

// OpenAI Types
export interface OpenAIToolCall {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

export interface OpenAITool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Anthropic Types
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Google Types
export interface GoogleTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// XAI Types
export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// Payload Types
export interface BasePayload {
  [key: string]: any;
}

export interface AnthropicPayload extends BasePayload {
  messages: Message[];
  tools?: AnthropicTool[];
  mcp_servers?: ConfiguredMCPServer[];
  betas?: string[];
}

export interface OpenAIPayload extends BasePayload {
  input: Message[];
  tools?: (OpenAITool | ConfiguredMCPServer)[];
}

export interface GooglePayload extends BasePayload {
  contents: Message[];
  model: string;
  config: {
    tools?: [{ functionDeclarations: GoogleTool[] }];
    [key: string]: any;
  };
}

export interface XAIPayload extends BasePayload {
  messages: Message[];
  tools?: ChatTool[];
  search_parameters?: SearchParameters;
}

export interface ChatPayload extends BasePayload {
  messages: Message[];
  model: string;
  tools?: ChatTool[];
}

// Tool Call Types (Consolidated from controllers)
export interface ToolCall {
  id?: string;
  index?: number;
  type: string;
  function?: {
    name: string;
    arguments: string | object;
  };
  name?: string;
  arguments?: string;
  call_id?: string;
  output_index?: number;
  input?: any;
}

export interface ToolInfo {
  toolId: string;
  schema: any;
}

export interface ToolCallResponse {
  toolCallResult: ToolCallResult;
  usage: any[] | null;
}

// Controller Response Types
export interface ChatResponse {
  success: boolean;
  thread_id?: string;
  error?: string;
  message?: string;
  [key: string]: any;
}

export interface OpenAIResponse {
  success: boolean;
  thread_id?: string | undefined;
  error?: string | undefined;
  message?: string | undefined;
  [key: string]: any;
}

export interface AnthropicResponse {
  success: boolean;
  thread_id?: string;
  error?: string;
  message?: string;
  [key: string]: any;
}

// MCP Call Types
export interface MCPCall {
  type: string;
  output?: string;
  content?: Array<{
    text: string;
  }>;
}

// Stream Chunk Types
export interface StreamChunk {
  type: string;
  delta?: string;
  item?: any;
  output_index?: number;
  response?: any;
}

// Database Table Types
export interface UserPollingFile {
  id: string;
  user_id: string;
  config: any; // JSONB
  file?: string;
  status: 'pending' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreateUserPollingFileRequest {
  user_id: string;
  config: any;
  file?: string;
}
