const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pools for all environments
const pools = {
    dev: mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'cicd_user',
        password: process.env.DB_PASSWORD || 'SecurePass123!',
        database: 'testdb_dev',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    }),
    qa: mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'cicd_user',
        password: process.env.DB_PASSWORD || 'SecurePass123!',
        database: 'testdb_qa',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    }),
    prod: mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'cicd_user',
        password: process.env.DB_PASSWORD || 'SecurePass123!',
        database: 'testdb_prod',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    })
};

// Helper function to get database info
async function getDatabaseInfo(pool, envName) {
    try {
        const connection = await pool.getConnection();
        
        // Get current version (latest changeset)
        const [changesets] = await connection.query(`
            SELECT ID, AUTHOR, FILENAME, DATEEXECUTED, DESCRIPTION, ORDEREXECUTED
            FROM DATABASECHANGELOG 
            ORDER BY DATEEXECUTED DESC 
            LIMIT 1
        `);

        // Get total changeset count
        const [countResult] = await connection.query(`
            SELECT COUNT(*) as total FROM DATABASECHANGELOG
        `);

        // Get database name
        const [dbName] = await connection.query(`SELECT DATABASE() as dbname`);

        connection.release();

        const latestChangeset = changesets[0];
        const currentVersion = latestChangeset ? extractVersion(latestChangeset.ID) : 'v1.0';

        return {
            environment: envName,
            status: 'healthy',
            currentVersion: currentVersion,
            changesetsApplied: countResult[0].total,
            lastUpdated: latestChangeset ? latestChangeset.DATEEXECUTED : null,
            database: dbName[0].dbname,
            latestChangeset: latestChangeset ? {
                id: latestChangeset.ID,
                author: latestChangeset.AUTHOR,
                description: latestChangeset.DESCRIPTION
            } : null
        };
    } catch (error) {
        console.error(`Error connecting to ${envName}:`, error.message);
        return {
            environment: envName,
            status: 'error',
            error: error.message,
            currentVersion: 'Unknown',
            changesetsApplied: 0,
            database: `testdb_${envName}`
        };
    }
}

// Helper function to extract version from changeset ID
function extractVersion(changesetId) {
    if (!changesetId) return 'v1.0';
    
    // Extract version patterns like "v1-1", "001", "006-add-user", etc.
    const versionMatch = changesetId.match(/v?(\d+)[.-](\d+)/i);
    if (versionMatch) {
        return `v${versionMatch[1]}.${versionMatch[2]}`;
    }
    
    // Try to extract just version number
    const numMatch = changesetId.match(/^(\d+)/);
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num <= 6) return 'v1.0';
        if (num <= 9) return 'v1.2';
        return 'v1.3';
    }
    
    return 'v1.0';
}

// API Routes

// 1. GET /api/environments - Get all environment statuses
app.get('/api/environments', async (req, res) => {
    try {
        const [devInfo, qaInfo, prodInfo] = await Promise.all([
            getDatabaseInfo(pools.dev, 'dev'),
            getDatabaseInfo(pools.qa, 'qa'),
            getDatabaseInfo(pools.prod, 'prod')
        ]);

        res.json({
            success: true,
            environments: [devInfo, qaInfo, prodInfo]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 2. GET /api/migrations/history - Get migration history for an environment
app.get('/api/migrations/history', async (req, res) => {
    const env = req.query.env || 'dev';
    const limit = parseInt(req.query.limit) || 10;

    try {
        const pool = pools[env];
        if (!pool) {
            return res.status(400).json({
                success: false,
                error: 'Invalid environment'
            });
        }

        const [changesets] = await pool.query(`
            SELECT 
                ID,
                AUTHOR,
                FILENAME,
                DATEEXECUTED,
                ORDEREXECUTED,
                EXECTYPE,
                MD5SUM,
                DESCRIPTION,
                COMMENTS,
                TAG,
                LIQUIBASE,
                DEPLOYMENT_ID
            FROM DATABASECHANGELOG 
            ORDER BY DATEEXECUTED DESC 
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            environment: env,
            count: changesets.length,
            history: changesets
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 3. GET /api/migrations/pending - Check for pending migrations (placeholder)
app.get('/api/migrations/pending', async (req, res) => {
    const env = req.query.env || 'dev';
    
    try {
        // In a real implementation, this would compare changelog files with database
        // For now, we'll return a mock response
        res.json({
            success: true,
            environment: env,
            pendingChangesets: [],
            message: 'No pending changesets. Database is up to date.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 4. GET /api/database/status - Check database connection status
app.get('/api/database/status', async (req, res) => {
    const env = req.query.env;

    try {
        if (env) {
            // Check specific environment
            const pool = pools[env];
            if (!pool) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid environment'
                });
            }

            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();

            res.json({
                success: true,
                environment: env,
                status: 'connected'
            });
        } else {
            // Check all environments
            const statuses = await Promise.all(
                Object.entries(pools).map(async ([name, pool]) => {
                    try {
                        const connection = await pool.getConnection();
                        await connection.ping();
                        connection.release();
                        return { environment: name, status: 'connected' };
                    } catch (error) {
                        return { environment: name, status: 'disconnected', error: error.message };
                    }
                })
            );

            res.json({
                success: true,
                statuses
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5. GET /api/migrations/diff - Compare schemas between environments
app.get('/api/migrations/diff', async (req, res) => {
    const env1 = req.query.env1 || 'dev';
    const env2 = req.query.env2 || 'prod';

    try {
        const pool1 = pools[env1];
        const pool2 = pools[env2];

        if (!pool1 || !pool2) {
            return res.status(400).json({
                success: false,
                error: 'Invalid environment(s)'
            });
        }

        const [changesets1] = await pool1.query(`
            SELECT ID, ORDEREXECUTED FROM DATABASECHANGELOG ORDER BY ORDEREXECUTED
        `);

        const [changesets2] = await pool2.query(`
            SELECT ID, ORDEREXECUTED FROM DATABASECHANGELOG ORDER BY ORDEREXECUTED
        `);

        const ids1 = changesets1.map(c => c.ID);
        const ids2 = changesets2.map(c => c.ID);

        const onlyInEnv1 = ids1.filter(id => !ids2.includes(id));
        const onlyInEnv2 = ids2.filter(id => !ids1.includes(id));

        res.json({
            success: true,
            environment1: {
                name: env1,
                totalChangesets: changesets1.length
            },
            environment2: {
                name: env2,
                totalChangesets: changesets2.length
            },
            differences: {
                onlyIn: {
                    [env1]: onlyInEnv1,
                    [env2]: onlyInEnv2
                },
                identical: ids1.length === ids2.length && onlyInEnv1.length === 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 6. GET /api/stats - Get overall statistics
app.get('/api/stats', async (req, res) => {
    try {
        const [devInfo, qaInfo, prodInfo] = await Promise.all([
            getDatabaseInfo(pools.dev, 'dev'),
            getDatabaseInfo(pools.qa, 'qa'),
            getDatabaseInfo(pools.prod, 'prod')
        ]);

        // Calculate statistics
        const totalChangesets = Math.max(
            devInfo.changesetsApplied,
            qaInfo.changesetsApplied,
            prodInfo.changesetsApplied
        );

        const healthyEnvs = [devInfo, qaInfo, prodInfo].filter(e => e.status === 'healthy').length;

        // Get latest deployment time
        const deployments = [devInfo, qaInfo, prodInfo]
            .filter(e => e.lastUpdated)
            .map(e => new Date(e.lastUpdated))
            .sort((a, b) => b - a);

        const lastDeployment = deployments[0];
        const timeDiff = lastDeployment ? Date.now() - lastDeployment.getTime() : 0;
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        res.json({
            success: true,
            stats: {
                totalChangesets,
                totalEnvironments: 3,
                healthyEnvironments: healthyEnvs,
                lastDeployment: {
                    timestamp: lastDeployment,
                    hoursAgo,
                    minutesAgo,
                    formatted: `${hoursAgo}h ${minutesAgo}m ago`
                },
                successRate: 98 // Mock for now - would calculate from deployment history
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 7. POST /api/migrations/rollback - Execute rollback (simulation or real)
app.post('/api/migrations/rollback', async (req, res) => {
    const { env, count } = req.body;
    
    if (!env || !count) {
        return res.status(400).json({
            success: false,
            error: 'Environment and count are required'
        });
    }

    if (!['dev', 'qa', 'prod'].includes(env)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid environment'
        });
    }

    try {
        // For safety, we'll return a simulation response
        // In production, you would execute the actual Liquibase command
        
        const envNames = { dev: 'DEV', qa: 'QA', prod: 'PROD' };
        const command = `liquibase --defaults-file=liquibase.${env}.properties rollback-count ${count}`;
        
        // SIMULATION MODE - doesn't actually execute
        // To enable real execution, uncomment the code below and comment out the simulation
        
        res.json({
            success: true,
            message: `Rollback simulation complete for ${envNames[env]}`,
            simulation: true,
            command: command,
            environment: env,
            changesetsRolledBack: count,
            note: 'This is a simulation. To enable real rollback, configure backend with proper authorization.'
        });

        /* REAL EXECUTION CODE (UNCOMMENT TO ENABLE):
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // Execute rollback command
        const { stdout, stderr } = await execPromise(command, {
            cwd: 'C:/LIQUIBASE_CICD/liquibase'
        });
        
        res.json({
            success: true,
            message: `Successfully rolled back ${count} changeset(s) in ${envNames[env]}`,
            simulation: false,
            command: command,
            environment: env,
            changesetsRolledBack: count,
            output: stdout
        });
        */
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            environment: env
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Liquibase API Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🗄️  Liquibase API Server Running                       ║
║                                                            ║
║     Port: ${PORT}                                          ║
║     Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                            ║
║     Available Endpoints:                                   ║
║     • GET  /api/environments                               ║
║     • GET  /api/migrations/history?env=dev&limit=10        ║
║     • GET  /api/migrations/pending?env=dev                 ║
║     • GET  /api/database/status?env=dev                    ║
║     • GET  /api/migrations/diff?env1=dev&env2=prod         ║
║     • GET  /api/stats                                      ║
║     • POST /api/migrations/rollback                        ║
║     • GET  /health                                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await Promise.all([
        pools.dev.end(),
        pools.qa.end(),
        pools.prod.end()
    ]);
    console.log('Database connections closed.');
    process.exit(0);
});