import { Request, Response } from 'express';
import axios from 'axios';
import { getClient } from '../../utils/supabaseClient';
import { getCurrentUser } from '../../utils/userUtils';

// Coolify Databases API Types
export interface CoolifyDatabase {
  id: string;
  name: string;
  type:
    | 'postgresql'
    | 'mysql'
    | 'mariadb'
    | 'mongodb'
    | 'redis'
    | 'keydb'
    | 'dragonfly'
    | 'clickhouse';
  status: string;
  created_at: string;
  updated_at: string;
  connection_string?: string;
}

export interface CoolifyDatabasesResponse {
  data: CoolifyDatabase[];
  total: number;
  page: number;
  per_page: number;
}

export interface CoolifyError {
  error: string;
  message?: string;
}

// Helper function to get and increment the next available port
const getNextAvailablePort = async (): Promise<number> => {
  try {
    const { supabase } = await getClient();

    // Get the current port value
    const { data: portData, error: fetchError } = await supabase
      .from('public_port')
      .select('id, port')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (fetchError) {
      // If no record exists, create one with default port 1000
      if (fetchError.code === 'PGRST116') {
        console.log('No port record found, creating initial record with port 1000');
        const { error: insertError } = await supabase
          .from('public_port')
          .insert({ port: 1001 })
          .select('id, port')
          .single();

        if (insertError) {
          console.error('Error creating initial port record:', insertError);
          throw new Error('Failed to create initial port record');
        }

        return 1000; // Return 1000 for the first database
      } else {
        console.error('Error fetching port:', fetchError);
        throw new Error('Failed to fetch port from database');
      }
    }

    const currentPort = portData?.port || 1000;
    const nextPort = currentPort + 1;

    // Update the port for next use
    const { error: updateError } = await supabase
      .from('public_port')
      .update({ port: nextPort })
      .eq('id', portData.id);

    if (updateError) {
      console.error('Error updating port:', updateError);
      throw new Error('Failed to update port in database');
    }

    return currentPort;
  } catch (error) {
    console.error('Error in getNextAvailablePort:', error);
    throw error;
  }
};

// Helper function to save database to user_cloud_databases table
const saveUserCloudDatabase = async (
  databaseUuid: string,
  type: string,
  publicPort: number,
  externalDbUrl: string,
  internalDbUrl: string,
  config: any,
  response: any
): Promise<any> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) {
      throw new Error('Current user ID is required');
    }

    const { supabase } = await getClient();
    const { data, error } = await supabase.from('user_cloud_databases').insert({
      user_id: currentUser.id,
      database_uuid: databaseUuid,
      type: type,
      public_port: publicPort,
      external_db_url: externalDbUrl,
      internal_db_url: internalDbUrl,
      config: config,
      response: response,
    }).select().single();

    if (error) {
      console.error('Error saving user cloud database:', error);
      throw new Error('Failed to save database information');
    }

    return data;
  } catch (error) {
    console.error('Error in saveUserCloudDatabase:', error);
    throw error;
  }
};

// Create PostgreSQL Database Request Interface
export interface CreatePostgreSQLDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //postgresql specific
  postgres_user: string;
  postgres_password: string;
  postgres_db: string;
  postgres_initdb_args?: string;
  postgres_host_auth_method?: string;
  postgres_conf?: string;
}

// Create MongoDB Database Request Interface
export interface CreateMongoDBDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //mongodb specific
  mongo_conf?: string;
  mongo_initdb_root_username?: string;
}

// Create ClickHouse Database Request Interface
export interface CreateClickHouseDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //clickhouse specific
  clickhouse_admin_user: string;
  clickhouse_admin_password: string
}

// Create DragonFly Database Request Interface
export interface CreateDragonFlyDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //dragonfly specific
  dragonfly_password: string;
}

// Create Redis Database Request Interface
export interface CreateRedisDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //redis specific
  redis_password: string;
  redis_conf?: string;
}

// Create KeyDB Database Request Interface
export interface CreateKeyDBDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //keydb specific
  keydb_password: string;
  keydb_conf?: string;
}

// Create MariaDB Database Request Interface
export interface CreateMariaDBDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //mariadb specific
  mariadb_conf?: string;
  mariadb_root_password: string;
  mariadb_user: string;
  mariadb_password: string;
  mariadb_database: string;
}

// Create MySQL Database Request Interface
export interface CreateMySQLDatabaseRequest {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name: string;
  description?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
  //mysql specific
  mysql_root_password: string;
  mysql_password: string;
  mysql_user: string;
  mysql_database: string;
  mysql_conf?: string;
}

// Get all databases from Coolify
export const getCoolifyDatabases = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(`${coolifyBaseUrl}/api/v1/databases`, {
      headers: {
        Authorization: `Bearer ${coolifyApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Databases API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch databases from Coolify',
    });
  }
};

// Create a new PostgreSQL database
export const createPostgreSQLDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreatePostgreSQLDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid = 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid = 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name ='production';
    databaseData.instant_deploy = true;
    databaseData.is_public = true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }
const newdbdata:any = databaseData;
delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/postgresql`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
console.log('response',response);
    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'postgresql',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error(
        'Failed to save PostgreSQL database to user table:',
        saveError
      );
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create PostgreSQL Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create PostgreSQL database in Coolify',
    });
  }
};

// Create a new MongoDB database
export const createMongoDBDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateMongoDBDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/mongodb`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'mongodb',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error(
        'Failed to save MongoDB database to user table:',
        saveError
      );
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create MongoDB Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create MongoDB database in Coolify',
    });
  }
};

// Create a new ClickHouse database
export const createClickHouseDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateClickHouseDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
delete newdbdata.type

      const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/clickhouse`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'clickhouse',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error(
        'Failed to save ClickHouse database to user table:',
        saveError
      );
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create ClickHouse Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create ClickHouse database in Coolify',
    });
  }
};

// Create a new DragonFly database
export const createDragonFlyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateDragonFlyDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/dragonfly`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'dragonfly',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error(
        'Failed to save DragonFly database to user table:',
        saveError
      );
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create DragonFly Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create DragonFly database in Coolify',
    });
  }
};

// Create a new Redis database
export const createRedisDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateRedisDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
    delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/redis`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'redis',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error('Failed to save Redis database to user table:', saveError);
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create Redis Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create Redis database in Coolify',
    });
  }
};

// Create a new KeyDB database
export const createKeyDBDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateKeyDBDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
    delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/keydb`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'keydb',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error('Failed to save KeyDB database to user table:', saveError);
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create KeyDB Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create KeyDB database in Coolify',
    });
  }
};

// Create a new MariaDB database
export const createMariaDBDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateMariaDBDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
    delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/mariadb`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'mariadb',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error(
        'Failed to save MariaDB database to user table:',
        saveError
      );
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create MariaDB Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create MariaDB database in Coolify',
    });
  }
};

// Create a new MySQL database
export const createMySQLDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const databaseData: CreateMySQLDatabaseRequest = req.body;

    // Set defaults
    databaseData.project_uuid =
      databaseData.project_uuid || 'zgcogowo04ww0k8cc4gc4wsg';
    databaseData.server_uuid =
      databaseData.server_uuid || 'b08o4o4ck8wo4kc0k8w848o8';
    databaseData.environment_name =
      databaseData.environment_name || 'production';
    databaseData.instant_deploy = databaseData.instant_deploy || true;
    databaseData.is_public = databaseData.is_public || true;

    // Get next available port
    databaseData.public_port = await getNextAvailablePort();

    // Validate required fields
    if (
      !databaseData.server_uuid ||
      !databaseData.project_uuid ||
      !databaseData.environment_name
    ) {
      res.status(400).json({
        success: false,
        error:
          'Missing required fields: server_uuid, project_uuid, environment_name',
      });
      return;
    }

    if (!databaseData.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: name',
      });
      return;
    }

    const newdbdata:any = databaseData;
    delete newdbdata.type

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/mysql`,
      newdbdata,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save database information to user_cloud_databases table
    let databaseRecord = null;
    try {
      databaseRecord = await saveUserCloudDatabase(
        response.data.uuid,
        'mysql',
        databaseData.public_port || 5432,
        response.data.external_db_url,
        response.data.internal_db_url,
        databaseData,
        response.data
      );
    } catch (saveError) {
      console.error('Failed to save MySQL database to user table:', saveError);
      // Don't fail the request if saving to user table fails
    }

    res.status(201).json({
      success: true,
      data: response.data,
      database_record: databaseRecord,
    });
  } catch (error: any) {
    console.error(
      'Coolify Create MySQL Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to create MySQL database in Coolify',
    });
  }
};

// Get a specific database by ID
export const getCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.get(
      `${coolifyBaseUrl}/api/v1/databases/${id}`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch database from Coolify',
    });
  }
};

// Start a database
export const startCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/${id}/start`,
      {},
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Start Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to start database in Coolify',
    });
  }
};

// Stop a database
export const stopCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/${id}/stop`,
      {},
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Stop Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to stop database in Coolify',
    });
  }
};

// Restart a database
export const restartCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const response = await axios.post(
      `${coolifyBaseUrl}/api/v1/databases/${id}/restart`,
      {},
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Coolify Restart Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to restart database in Coolify',
    });
  }
};

// Update a database by UUID
export const updateCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { uuid } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    const updateData = req.body;

    // Validate that we have data to update
    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No update data provided',
      });
      return;
    }

    const response = await axios.patch(
      `${coolifyBaseUrl}/api/v1/databases/${uuid}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });

    // Update database in user_cloud_databases table
    try {
      const currentUser = getCurrentUser();
      if (currentUser?.id) {
        const { supabase } = await getClient();

        // Prepare update data for user table
        const userTableUpdateData: any = {};

        // Map relevant fields to user table
        if (updateData.name) {userTableUpdateData.name = updateData.name;}
        if (updateData.description)
          {userTableUpdateData.description = updateData.description;}
        if (updateData.is_public !== undefined)
          {userTableUpdateData.is_public = updateData.is_public;}
        if (updateData.public_port !== undefined)
          {userTableUpdateData.public_port = updateData.public_port;}

        // Update config and response with new data
        userTableUpdateData.config = updateData;
        userTableUpdateData.response = response.data;

        const { error } = await supabase
          .from('user_cloud_databases')
          .update(userTableUpdateData)
          .eq('database_uuid', uuid)
          .eq('user_id', currentUser.id);

        if (error) {
          console.error('Failed to update database in user table:', error);
        }
      }
    } catch (updateError) {
      console.error('Failed to update database in user table:', updateError);
      // Don't fail the request if updating user table fails
    }
  } catch (error: any) {
    console.error(
      'Coolify Update Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to update database in Coolify',
    });
  }
};

// Delete a database by UUID
export const deleteCoolifyDatabase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { uuid } = req.params;
    const coolifyApiKey = process.env.COOLIFY_API_KEY;

    if (!coolifyApiKey) {
      res.status(500).json({
        success: false,
        error: 'Coolify API key not configured',
      });
      return;
    }

    const coolifyBaseUrl =
      process.env.COOLIFY_BASE_URL || 'https://app.coolify.io';

    // Query parameters for deletion options
    const {
      delete_configurations = 'true',
      delete_volumes = 'true',
      docker_cleanup = 'true',
      delete_connected_networks = 'true',
    } = req.query;

    const response = await axios.delete(
      `${coolifyBaseUrl}/api/v1/databases/${uuid}`,
      {
        headers: {
          Authorization: `Bearer ${coolifyApiKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          delete_configurations,
          delete_volumes,
          docker_cleanup,
          delete_connected_networks,
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });

    // Delete database from user_cloud_databases table
    try {
      const currentUser = getCurrentUser();
      if (currentUser?.id) {
        const { supabase } = await getClient();
        const { error } = await supabase
          .from('user_cloud_databases')
          .delete()
          .eq('database_uuid', uuid)
          .eq('user_id', currentUser.id);

        if (error) {
          console.error('Failed to delete database from user table:', error);
        }
      }
    } catch (deleteError) {
      console.error('Failed to delete database from user table:', deleteError);
      // Don't fail the request if deleting from user table fails
    }
  } catch (error: any) {
    console.error(
      'Coolify Delete Database API Error:',
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        'Failed to delete database in Coolify',
    });
  }
};
