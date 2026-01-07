import { Response, Request } from 'express';
import { SSEEvent } from '../types';

/**
 * Set up Server-Sent Events (SSE) headers for streaming responses
 */
export const setupSSEHeaders = (res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();
};

/**
 * Send an SSE event to the client
 */
export const sendSSEEvent = (res: Response, data: SSEEvent): void => {
  try {
    const jsonData = JSON.stringify(data);
    res.write(`data: ${jsonData}\n\n`);
    // Note: Express doesn't have res.flush(), data is sent immediately with res.write()
  } catch (error) {
    console.error('Error serializing SSE data:', error);
    // Send a simplified error message
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: 'Data serialization error' })}\n\n`
    );
  }
};

/**
 * Send a heartbeat to keep the connection alive
 */
export const sendHeartbeat = (res: Response): void => {
  try {
    res.write(
      `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`
    );
  } catch (error) {
    console.error('Error sending heartbeat:', error);
  }
};

/**
 * Start heartbeat interval to keep connection alive
 */
export const startHeartbeat = (
  res: Response,
  intervalMs: number = 30000
): NodeJS.Timeout => {
  return setInterval(() => {
    sendHeartbeat(res);
  }, intervalMs);
};

/**
 * Handle client disconnect and abort stream
 */
export const handleClientDisconnect = (req: Request, stream: any): void => {
  req.on('close', () => {
    if (stream && typeof stream.abort === 'function') {
      stream.abort();
    }
  });
};

/**
 * Validate required request body fields
 */
export const validateRequestBody = (
  req: Request,
  requiredFields: string[] = ['messages']
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!req.body[field]) {
      errors.push(`${field} is required`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Handle errors in streaming context
 */
export const handleStreamingError = (
  res: Response,
  error: any,
  context: string = 'streaming'
): void => {
  console.error(`Error in ${context}:`, error);

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: error.error || 'Internal server error',
      message: error.message,
    });
  } else {
    sendSSEEvent(res, {
      type: 'error',
      text: error.message || 'Internal server error',
    });
    res.end();
  }
};

export const validateAndCompleteArgs = (
  functionCall: any,
  toolSchema: any
): { errors: string[]; completedArgs: any } => {
  const errors: string[] = [];
  const completedArgs = functionCall.args
    ? { ...functionCall.args }
    : functionCall?.input || JSON.parse(functionCall?.arguments);

  // Check required parameters and add defaults for missing ones
  if (toolSchema.required && Array.isArray(toolSchema.required)) {
    for (const requiredParam of toolSchema.required) {
      if (completedArgs[requiredParam] === undefined) {
        // Try to find default value in the schema
        const paramSchema = toolSchema.properties?.[requiredParam];
        if (paramSchema && paramSchema.default !== undefined) {
          completedArgs[requiredParam] = paramSchema.default;
        } else {
          errors.push(
            `Missing required parameter: ${requiredParam} (no default value available)`
          );
        }
      }
    }
  }
  return { errors, completedArgs };
};
