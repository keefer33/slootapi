import { getClient } from './supabaseClient';
import { ChatRequest, Message, Usage } from '../types';

interface ThreadMessage {
  id: string;
  thread_id: string;
  user_id: string;
  settings: any;
  extra: any;
  messages: Message[];
  usage: Usage[];
  created_at: string;
}

interface Thread {
  id: string;
  user_id: string;
  name: string;
  model_id: string;
  created_at: string;
}

export const getThreadContents = async (
  threadId: string,
  userId: string
): Promise<ThreadMessage[]> => {
  const { supabase } = await getClient();
  const { data: threads, error: threadError } = await supabase
    .from('thread_messages')
    .select('messages')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (threadError) {
    console.error('Thread error:', threadError);
    return [];
  }
  return threads || [];
};

export const createThread = async (
  userId: string,
  prompt: string,
  modelId: string
): Promise<Thread | null> => {
  const { supabase } = await getClient();
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      user_id: userId,
      name: prompt.trim().slice(0, 100),
      model_id: modelId,
    })
    .select()
    .single();

  if (threadError) {
    console.error('Thread error:', threadError);
    return null;
  }
  return thread;
};

export const createThreadMessage = async (
  req: ChatRequest,
  threadId: string | null,
  userId: string,
  messages: Message[],
  settings: any,
  extra: any,
  usage: Usage[]
): Promise<string> => {
  const { supabase } = await getClient();

  if (!threadId) {
    const thread = await createThread(
      req.user.userId,
      req.body.prompt,
      req.user.userModel.id
    );
    threadId = thread?.id || null;
  }

  if (!threadId) {
    throw new Error('Failed to create thread');
  }

  const { error: threadMessageError } = await supabase
    .from('thread_messages')
    .insert({
      thread_id: threadId,
      user_id: userId,
      settings: settings,
      extra: extra,
      messages: messages,
      usage: usage,
    })
    .select()
    .single();

  if (threadMessageError) {
    console.error('Thread message error:', threadMessageError);
    throw new Error('Failed to create thread message');
  }

  // Only save usage if user doesn't have their own API key
  if (
    !req.user.userModel.apikey ||
    (typeof req.user.userModel.apikey === 'object' &&
      !req.user.userModel.apikey.key)
  ) {
    await saveUsage(usage, userId);
  }

  return threadId;
};

export const getLastThreadMessage = async (
  threadId: string,
  userId: string
): Promise<ThreadMessage | null> => {
  const { supabase } = await getClient();
  const { data: threadMessage, error: threadMessageError } = await supabase
    .from('thread_messages')
    .select('*')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (threadMessageError) {
    console.error('Thread message error:', threadMessageError);
    return null;
  }
  return threadMessage;
};

export const loadAgentThreads = async (
  threadId: string | null,
  req: ChatRequest
): Promise<{ allThreadMessages: Message[]; threadId: string | null }> => {
  let allThreadMessages: Message[] = [];
  if (threadId) {
    const threads = await getThreadContents(threadId, req.user.userId);
    threads?.forEach(message => {
      allThreadMessages = [...allThreadMessages, ...message.messages];
    });
  }
  return { allThreadMessages, threadId };
};

/**
 * Save usage data to the usage table
 */
export const saveUsage = async (
  usage: Usage | Usage[],
  userId: string
): Promise<any> => {
  const { supabase } = await getClient();

  try {
    // Handle both single usage object and array of usage items
    const usageArray = Array.isArray(usage) ? usage : [usage];

    // Separate model and tool usage items
    const modelUsageItems = usageArray.filter(
      (item: any) => item.type === 'model'
    );
    /*
    const toolUsageItems = usageArray.filter(
      (item: any) => item.type === 'tool'
    );
    */

    const savePromises: Promise<any>[] = [];

    // Aggregate model usage items into a single record
    if (modelUsageItems.length > 0) {
      const aggregatedModelUsage = modelUsageItems.reduce(
        (acc: any, usageItem: any) => {
          return {
            input_tokens:
              (acc.input_tokens || 0) +
              (usageItem.breakdown?.input_tokens || 0),
            output_tokens:
              (acc.output_tokens || 0) +
              (usageItem.breakdown?.output_tokens || 0),
            total_cost:
              (acc.total_cost || 0) + (usageItem.costs?.total_cost || 0),
            brand: usageItem.brand || 'unknown',
            model: usageItem.model || 'unknown',
            usage_summary: [...(acc.usage_summary || []), usageItem], // Store all model usage items
          };
        },
        {
          input_tokens: 0,
          output_tokens: 0,
          total_cost: 0,
          brand: 'unknown',
          model: 'unknown',
          usage_summary: [] as any[],
        }
      );

      // Only add model usage save promise if total_cost > 0
      if (aggregatedModelUsage.total_cost > 0) {
        savePromises.push(
          supabase
            .from('user_usage')
            .insert({
              user_id: userId,
              usage_summary: aggregatedModelUsage.usage_summary,
              type: 'model',
              input_tokens: aggregatedModelUsage.input_tokens,
              output_tokens: aggregatedModelUsage.output_tokens,
              total_cost: aggregatedModelUsage.total_cost,
              brand: aggregatedModelUsage.brand,
              model: aggregatedModelUsage.model,
            })
            .select()
            .single()
        );
      }
    }

    /*
    // Turned off for now because we are saving durning the tool run in saveSlootToolUsage
    // Add each tool usage item separately
    toolUsageItems.forEach((usageItem: any) => {
      savePromises.push(
        supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_summary: usageItem,
            type: 'tool',
            input_tokens: 0, // Tools typically don't have input/output tokens
            output_tokens: 0,
            total_cost: usageItem.total_cost || 0,
            brand: usageItem.brand || 'unknown',
            model: usageItem.toolName || 'unknown', // Store toolName as model for tools
          })
          .select()
          .single()
      );
    });
    */

    // Wait for all promises to resolve
    const results = await Promise.all(savePromises);

    // Filter out null results (failed saves) and return appropriate format
    const savedRecords = results.filter(result => result.data !== null);

    // Return single record if input was single, array if input was array
    return Array.isArray(usage) ? savedRecords : savedRecords[0] || null;
  } catch (error) {
    console.error('Error in saveUsage:', error);
    return null;
  }
};
