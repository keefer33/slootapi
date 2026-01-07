import { Request, Response } from 'express';
import { getClient } from '../utils/supabaseClient';
import { getPipedreamClient } from '../utils/pipedreamClient';
import { AuthenticatedRequest } from '../types';
import { ToolResponse } from './toolsController';
import { FinalResponse, saveToolRun } from '../utils/runToolUtils';

interface PipedreamQuery {
  sortKey?: 'featured_weight' | 'name' | 'created_at';
  sortDirection?: 'asc' | 'desc';
  q?: string;
  limit?: number;
  after?: string;
  before?: string;
  category_ids?: string[];
}

interface PipedreamMemberAppsOptions {
  externalUserId: string;
  appId?: string;
  limit?: number;
}

export const runPipedreamActionRoute = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { payload } = req.body;
  const action = await runPipedreamAction(
    (req as AuthenticatedRequest).user.userId,
    payload.toolId,
    payload.toolName,
    payload.authProvisionId,
    payload.appType,
    payload.args
  );
  res.status(200).json(action);
};

export const runPipedreamAction = async (
  userId: string,
  toolId: string,
  toolName: string,
  authProvisionId: string,
  appType: string,
  payload: any
): Promise<any> => {
  let executionTime = 0;
  const startTime = Date.now();
  const pd = getPipedreamClient();
  const action = await pd.actions.run({
    externalUserId: userId,
    id: toolName,
    configuredProps: {
      [appType]: {
        authProvisionId: authProvisionId,
      },
      ...payload,
    },
  });
  const finalResponse: FinalResponse = { result: action, usage: null };
  executionTime = Date.now() - startTime;
  await saveToolRun(
    userId,
    toolId,
    payload,
    finalResponse,
    executionTime
  );
  return finalResponse;
};

export const pipedreamAppCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  const pd = getPipedreamClient();
  const categories = await pd.appCategories.list();
  res.status(200).json(categories);
};

export const pipedreamApps = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query: PipedreamQuery = {
      sortKey: 'featured_weight',
      sortDirection: 'desc',
      //category_ids: ['Marketing'],
    };

    // Only add parameters if they are set and not empty
    if (
      req.query.q &&
      typeof req.query.q === 'string' &&
      req.query.q.trim() !== ''
    ) {
      query.q = req.query.q;
    }

    if (
      req.query.limit &&
      typeof req.query.limit === 'string' &&
      req.query.limit.trim() !== ''
    ) {
      query.limit = parseInt(req.query.limit);
    } else {
      query.limit = 24;
    }

    if (
      req.query.after &&
      typeof req.query.after === 'string' &&
      req.query.after.trim() !== ''
    ) {
      query.after = req.query.after;
    }

    if (
      req.query.before &&
      typeof req.query.before === 'string' &&
      req.query.before.trim() !== ''
    ) {
      query.before = req.query.before;
    }

    const pd = getPipedreamClient();

    const categories = await pd.appCategories.list();
    console.log(categories);
console.log(query);
    const apps:any = await pd.apps.list(query as any);
    res.status(200).json(apps.response);
  } catch (error: any) {
    console.error('Error in pipedreamApps:', error);
    const errorResponse: ToolResponse = {
      success: false,
      error: 'Internal server error',
      message: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

export const pipedreamAccountsList = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.body;
    const opts: PipedreamMemberAppsOptions = {
      externalUserId: (req as AuthenticatedRequest).user.userId,
      //include_credentials: true,
      limit: 100,
    };

    // Only add app parameter if it's provided and not empty
    if (data.appId && data.appId.trim() !== '') {
      opts.appId = data.appId;
    }
    const pd = getPipedreamClient();
    const account = await pd.accounts.list(opts);

    res.status(200).json(account);
  } catch (error: any) {
    console.error('Error in pipedreamMemberApps:', error);
    const errorResponse: ToolResponse = {
      success: false,
      error: 'Internal server error',
      message: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

export const pipedreamGetApp = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { appId } = req.params;
  if (!appId) {
    const errorResponse: ToolResponse = {
      success: false,
      error: 'App ID is required',
    };
    res.status(400).json(errorResponse);
    return;
  }
  const pd = getPipedreamClient();
  const app = await pd.apps.retrieve(appId);
  const actions = await pd.actions.list({
    app: appId,
    limit: 100,
  });
  const finalApp = {
    ...app.data,
    actions: actions.data,
  };
  (app as any).actions = actions;
  res.status(200).json(finalApp);
};

export const pipedreamGetAccountApp = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { accountId } = req.params;
  if (!accountId) {
    const errorResponse: ToolResponse = {
      success: false,
      error: 'Account ID is required',
    };
    res.status(400).json(errorResponse);
    return;
  }
  const pd = getPipedreamClient();
  const app = await pd.accounts.retrieve(accountId);
  res.status(200).json(app);
};

export const pipedreamCreateConnectToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const pd = getPipedreamClient();
  const token = await pd.tokens.create({
    externalUserId: (req as AuthenticatedRequest).user.userId,
    //allowed_origins: ['http://localhost:5173'],
  });
  if ((token as any)?.error) {
    const errorResponse: ToolResponse = {
      success: false,
      error: (token as any)?.error?.message,
    };
    res.status(500).json(errorResponse);
    return;
  }
  res.status(200).json(token);
};

export const pipedreamDeleteConnectedAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { accountId } = req.body;
  const pd = getPipedreamClient();
  const account = await pd.accounts.delete(accountId);
  if ((account as any)?.error) {
    const errorResponse: ToolResponse = {
      success: false,
      error: (account as any)?.error?.message,
    };
    res.status(500).json(errorResponse);
    return;
  }
  const successResponse: ToolResponse = {
    success: true,
  };
  res.status(200).json(successResponse);
};

export const deletePipedreamTools = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { accountId } = req.body;
  const { supabase } = await getClient();
  const { error } = await supabase
    .from('user_tools')
    .delete()
    .eq('pipedream->>id', accountId);
  if (error) {
    const errorResponse: ToolResponse = {
      success: false,
      error: error.message,
    };
    res.status(500).json(errorResponse);
    return;
  }
  const successResponse: ToolResponse = {
    success: true,
  };
  res.status(200).json(successResponse);
};
