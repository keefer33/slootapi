import express from 'express';
import { verifyJWT } from '../../middleware/jwtAuth';
import { getCoolifyResources, getCoolifyResource } from './coolifyResources';
import {
  getCoolifyApplications,
  getCoolifyApplication,
  startCoolifyApplication,
  stopCoolifyApplication,
  restartCoolifyApplication,
} from './coolifyApplications';
import {
  getCoolifyDatabases,
  getCoolifyDatabase,
  createPostgreSQLDatabase,
  createMongoDBDatabase,
  createClickHouseDatabase,
  createDragonFlyDatabase,
  createRedisDatabase,
  createKeyDBDatabase,
  createMariaDBDatabase,
  createMySQLDatabase,
  startCoolifyDatabase,
  stopCoolifyDatabase,
  restartCoolifyDatabase,
  updateCoolifyDatabase,
  deleteCoolifyDatabase,
} from './coolifyDatabases';
import {
  getCoolifyServers,
  getCoolifyServer,
  createCoolifyServer,
  updateCoolifyServer,
  deleteCoolifyServer,
  getCoolifyServerResources,
  getCoolifyServerDomains,
  validateCoolifyServer,
} from './coolifyServers';
import {
  createCoolifyService,
  updateCoolifyService,
  deleteCoolifyService,
  getCoolifyServiceEnvs,
  createCoolifyServiceEnv,
  updateCoolifyServiceEnv,
  updateCoolifyServiceEnvsBulk,
  deleteCoolifyServiceEnv,
  getUserCloudServiceById,
  updateUserCloudService,
  deleteUserCloudServiceById,
  getUserCloudService,
  startCoolifyService,
  stopCoolifyService,
  restartCoolifyService,
  getUserCloudServicesByUserId,
} from './coolifyServices';
import {
  getUserCloudDatabasesByUserId,
  getUserCloudDatabase,
  createUserCloudDatabase,
  updateUserCloudDatabase,
  deleteUserCloudDatabase,
  getUserCloudDatabaseByUuid,
} from './coolifyUserDatabases';

const router = express.Router();

router.use(verifyJWT);

// Coolify Resources routes
// GET /coolify/resources - Get all resources
// GET /coolify/resources/:id - Get a specific resource
router.get('/resources', getCoolifyResources);
router.get('/resources/:id', getCoolifyResource);

// Coolify Applications routes
// GET /coolify/applications - Get all applications
// GET /coolify/applications/:id - Get a specific application
// GET /coolify/applications/:id/start - Start an application
// GET /coolify/applications/:id/stop - Stop an application
// GET /coolify/applications/:id/restart - Restart an application
router.get('/applications', getCoolifyApplications);
router.get('/applications/:id', getCoolifyApplication);
router.get('/applications/:id/start', startCoolifyApplication);
router.get('/applications/:id/stop', stopCoolifyApplication);
router.get('/applications/:id/restart', restartCoolifyApplication);

// Coolify Databases routes
// GET /coolify/databases - Get all databases
// GET /coolify/databases/:id - Get a specific database
// POST /coolify/databases/postgresql - Create a new PostgreSQL database
// POST /coolify/databases/mongodb - Create a new MongoDB database
// POST /coolify/databases/clickhouse - Create a new ClickHouse database
// POST /coolify/databases/dragonfly - Create a new DragonFly database
// POST /coolify/databases/redis - Create a new Redis database
// POST /coolify/databases/keydb - Create a new KeyDB database
// POST /coolify/databases/mariadb - Create a new MariaDB database
// POST /coolify/databases/mysql - Create a new MySQL database
// POST /coolify/databases/:id/start - Start a database
// POST /coolify/databases/:id/stop - Stop a database
// POST /coolify/databases/:id/restart - Restart a database
// PATCH /coolify/databases/:uuid - Update a database by UUID
// DELETE /coolify/databases/:uuid - Delete a database by UUID
router.get('/databases', getCoolifyDatabases);
router.get('/databases/:id', getCoolifyDatabase);
router.post('/databases/postgresql', createPostgreSQLDatabase);
router.post('/databases/mongodb', createMongoDBDatabase);
router.post('/databases/clickhouse', createClickHouseDatabase);
router.post('/databases/dragonfly', createDragonFlyDatabase);
router.post('/databases/redis', createRedisDatabase);
router.post('/databases/keydb', createKeyDBDatabase);
router.post('/databases/mariadb', createMariaDBDatabase);
router.post('/databases/mysql', createMySQLDatabase);
router.post('/databases/:id/start', startCoolifyDatabase);
router.post('/databases/:id/stop', stopCoolifyDatabase);
router.post('/databases/:id/restart', restartCoolifyDatabase);
router.patch('/databases/:uuid', updateCoolifyDatabase);
router.delete('/databases/:uuid', deleteCoolifyDatabase);

// Coolify Servers routes
// GET /coolify/servers - Get all servers
// GET /coolify/servers/:id - Get a specific server
// POST /coolify/servers - Create a new server
// PATCH /coolify/servers/:id - Update a server
// DELETE /coolify/servers/:id - Delete a server
// GET /coolify/servers/:id/resources - Get server resources
// GET /coolify/servers/:id/domains - Get server domains
// GET /coolify/servers/:id/validate - Validate server
router.get('/servers', getCoolifyServers);
router.get('/servers/:id', getCoolifyServer);
router.post('/servers', createCoolifyServer);
router.patch('/servers/:id', updateCoolifyServer);
router.delete('/servers/:id', deleteCoolifyServer);
router.get('/servers/:id/resources', getCoolifyServerResources);
router.get('/servers/:id/domains', getCoolifyServerDomains);
router.get('/servers/:id/validate', validateCoolifyServer);

// Coolify Service Creation and Management routes
// POST /coolify/services/create - Create a new service
// PATCH /coolify/services/:id/update - Update a service
// DELETE /coolify/services/:id/delete - Delete a service
// GET /coolify/services/:id/envs - Get service environment variables
// POST /coolify/services/:id/envs - Create service environment variable
// PATCH /coolify/services/:id/envs/:envId - Update service environment variable
// PATCH /coolify/services/:id/envs/bulk - Update service environment variables (bulk)
// DELETE /coolify/services/:id/envs/:envId - Delete service environment variable
router.post('/services/create', createCoolifyService);
router.patch('/services/:id/update', updateCoolifyService);
router.delete('/services/:id/delete', deleteCoolifyService);
router.get('/services/:id/envs', getCoolifyServiceEnvs);
router.post('/services/:id/envs', createCoolifyServiceEnv);
router.patch('/services/:id/envs/:envId', updateCoolifyServiceEnv);
router.patch('/services/:id/envs/bulk', updateCoolifyServiceEnvsBulk);
router.delete('/services/:id/envs/:envId', deleteCoolifyServiceEnv);

// Database management routes for user cloud services
// GET /coolify/database/services - Get user's cloud services from database
// GET /coolify/database/services/:id - Get specific cloud service from database
// PATCH /coolify/database/services/:id - Update cloud service in database
// DELETE /coolify/database/services/:id - Delete cloud service from database
router.get('/database/services', getUserCloudServicesByUserId);
router.get('/database/services/:id', getUserCloudService);
router.patch('/database/services/:id', updateUserCloudService);
router.delete('/database/services/:id', deleteUserCloudServiceById);

// Coolify Services routes
// GET /coolify/services/:id - Get a specific service
// GET /coolify/services/:id/start - Start a service
// GET /coolify/services/:id/stop - Stop a service
// GET /coolify/services/:id/restart - Restart a service
router.get('/services/:id', getUserCloudServiceById);
router.get('/services/:id/start', startCoolifyService);
router.get('/services/:id/stop', stopCoolifyService);
router.get('/services/:id/restart', restartCoolifyService);

// User Cloud Databases routes
// GET /coolify/user-databases - Get user's cloud databases
// GET /coolify/user-databases/:id - Get specific user cloud database
// POST /coolify/user-databases - Create a new user cloud database
// PATCH /coolify/user-databases/:id - Update user cloud database
// DELETE /coolify/user-databases/:id - Delete user cloud database
// GET /coolify/user-databases/uuid/:uuid - Get user cloud database by UUID
router.get('/user-databases', getUserCloudDatabasesByUserId);
router.get('/user-databases/:id', getUserCloudDatabase);
router.post('/user-databases', createUserCloudDatabase);
router.patch('/user-databases/:id', updateUserCloudDatabase);
router.delete('/user-databases/:id', deleteUserCloudDatabase);
router.get('/user-databases/uuid/:uuid', getUserCloudDatabaseByUuid);

export default router;
