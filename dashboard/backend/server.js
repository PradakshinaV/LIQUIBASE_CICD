const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pools
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
        
        const [changesets] = await connection.query(`
            SELECT ID, AUTHOR, FILENAME, DATEEXECUTED, DESCRIPTION, ORDEREXECUTED
            FROM DATABASECHANGELOG 
            ORDER BY DATEEXECUTED DESC 
            LIMIT 1
        `);

        const [countResult] = await connection.query(`
            SELECT COUNT(*) as total FROM DATABASECHANGELOG
        `);

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

function extractVersion(changesetId) {
    if (!changesetId) return 'v1.0';
    
    const versionMatch = changesetId.match(/v?(\d+)[.-](\d+)/i);
    if (versionMatch) {
        return `v${versionMatch[1]}.${versionMatch[2]}`;
    }
    
    const numMatch = changesetId.match(/^(\d+)/);
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num <= 6) return 'v1.0';
        if (num <= 9) return 'v1.2';
        return 'v1.3';
    }
    
    return 'v1.0';
}

// ============================================
// API ENDPOINTS
// ============================================

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
                ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED,
                EXECTYPE, MD5SUM, DESCRIPTION, COMMENTS, TAG,
                LIQUIBASE, DEPLOYMENT_ID
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

app.get('/api/database/status', async (req, res) => {
    const env = req.query.env;

    try {
        if (env) {
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

app.get('/api/stats', async (req, res) => {
    try {
        const [devInfo, qaInfo, prodInfo] = await Promise.all([
            getDatabaseInfo(pools.dev, 'dev'),
            getDatabaseInfo(pools.qa, 'qa'),
            getDatabaseInfo(pools.prod, 'prod')
        ]);

        const totalChangesets = Math.max(
            devInfo.changesetsApplied,
            qaInfo.changesetsApplied,
            prodInfo.changesetsApplied
        );

        const healthyEnvs = [devInfo, qaInfo, prodInfo].filter(e => e.status === 'healthy').length;

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
                successRate: 98
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
            error: 'Invalid environment. Must be dev, qa, or prod'
        });
    }

    // Validate count
    if (count < 1 || count > 10) {
        return res.status(400).json({
            success: false,
            error: 'Count must be between 1 and 10'
        });
    }

    // Get current changesets before rollback
    let beforeChangesets = 0;
    try {
        const [countResult] = await pools[env].query(
            'SELECT COUNT(*) as total FROM DATABASECHANGELOG'
        );
        beforeChangesets = countResult[0].total;
        
        if (beforeChangesets < count) {
            return res.status(400).json({
                success: false,
                error: `Cannot rollback ${count} changesets. Only ${beforeChangesets} changesets exist in ${env.toUpperCase()}.`
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to get current changeset count: ' + error.message
        });
    }

    // FIXED: Use the correct path to liquibase directory
    // Go up two directories from backend to reach LIQUIBASE_CICD, then into liquibase
    const liquibaseDir = path.join(process.cwd(), '..', '..', 'liquibase');
    const propsFile = path.join(liquibaseDir, `liquibase.${env}.properties`);
    
    console.log('Looking for properties file at:', propsFile);
    console.log('Properties file exists:', fs.existsSync(propsFile));
    
    if (!fs.existsSync(propsFile)) {
        return res.status(500).json({
            success: false,
            error: `Liquibase properties file not found: ${propsFile}`,
            currentDir: process.cwd(),
            expectedPath: propsFile,
            troubleshooting: [
                'Check if file exists at: ' + propsFile,
                'Current working directory: ' + process.cwd(),
                `Ensure liquibase.${env}.properties exists in C:\\LIQUIBASE_CICD\\liquibase\\`,
                'Verify the file contains: url, username, password, changeLogFile'
            ]
        });
    }

    // Execute Liquibase rollback from the liquibase directory
    // Use relative path for properties file since we're changing directory
    const liquibaseCmd = `liquibase --defaults-file=liquibase.${env}.properties rollback-count ${count}`;

    console.log(`Executing: ${liquibaseCmd} in directory: ${liquibaseDir}`);

    try {
        const { stdout, stderr } = await execPromise(liquibaseCmd, {
            cwd: liquibaseDir,  // IMPORTANT: Run from liquibase directory
            timeout: 30000 // 30 second timeout
        });

        // Wait a moment for database to settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get changesets after rollback
        const [afterCountResult] = await pools[env].query(
            'SELECT COUNT(*) as total FROM DATABASECHANGELOG'
        );
        const afterChangesets = afterCountResult[0].total;
        const actualRolledBack = beforeChangesets - afterChangesets;

        // Get latest changeset info
        const [latestChangeset] = await pools[env].query(`
            SELECT ID, AUTHOR, DATEEXECUTED, DESCRIPTION
            FROM DATABASECHANGELOG 
            ORDER BY ORDEREXECUTED DESC 
            LIMIT 1
        `);

        res.json({
            success: true,
            message: `Successfully rolled back ${actualRolledBack} changeset(s) in ${env.toUpperCase()}`,
            simulation: false,
            environment: env,
            changesetsRolledBack: actualRolledBack,
            changesetsBefore: beforeChangesets,
            changesetsAfter: afterChangesets,
            currentChangeset: latestChangeset[0] || null,
            command: liquibaseCmd,
            workingDirectory: liquibaseDir,
            output: stdout || 'Rollback completed successfully'
        });
        
    } catch (error) {
        console.error('Rollback error:', error);
        
        // Try to get current state even after error
        let currentState = {};
        try {
            const [countResult] = await pools[env].query(
                'SELECT COUNT(*) as total FROM DATABASECHANGELOG'
            );
            currentState.remainingChangesets = countResult[0].total;
        } catch (e) {
            currentState.error = 'Could not determine current state';
        }

        // Better error message formatting
        let errorMessage = error.message;
        if (error.code === 'ENOENT') {
            errorMessage = 'Liquibase command not found. Please ensure Liquibase is installed and in your PATH.';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: {
                command: liquibaseCmd,
                workingDirectory: liquibaseDir,
                stderr: error.stderr || 'No error output',
                stdout: error.stdout || 'No standard output',
                code: error.code
            },
            environment: env,
            currentState,
            troubleshooting: [
                'Check if Liquibase is installed: run "liquibase --version"',
                'Verify liquibase properties file exists at: ' + propsFile,
                'Ensure database credentials are valid',
                'Check if changesets have rollback commands defined in XML/SQL',
                'Review server console logs for detailed error information',
                'Verify database connection is working'
            ]
        });
    }
});

// Rollback preview endpoint
app.get('/api/migrations/rollback-preview', async (req, res) => {
    const env = req.query.env || 'dev';
    const count = parseInt(req.query.count) || 1;

    try {
        const pool = pools[env];
        if (!pool) {
            return res.status(400).json({
                success: false,
                error: 'Invalid environment'
            });
        }

        // Get the changesets that would be rolled back
        const [changesets] = await pool.query(`
            SELECT 
                ID, AUTHOR, DATEEXECUTED, DESCRIPTION, ORDEREXECUTED
            FROM DATABASECHANGELOG 
            ORDER BY ORDEREXECUTED DESC 
            LIMIT ?
        `, [count]);

        res.json({
            success: true,
            environment: env,
            changesetCount: changesets.length,
            changesetsToRollback: changesets,
            warning: `This will rollback ${changesets.length} changeset(s) from ${env.toUpperCase()}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// MONITORING ENDPOINTS
// ============================================

app.get('/api/monitoring/execution-times', async (req, res) => {
    const env = req.query.env || 'dev';
    const limit = parseInt(req.query.limit) || 20;

    try {
        const pool = pools[env];
        if (!pool) {
            return res.status(400).json({ success: false, error: 'Invalid environment' });
        }

        const [changesets] = await pool.query(`
            SELECT 
                ID, AUTHOR, DATEEXECUTED, ORDEREXECUTED,
                DESCRIPTION, EXECTYPE
            FROM DATABASECHANGELOG 
            ORDER BY ORDEREXECUTED DESC
            LIMIT ?
        `, [limit]);

        const executionData = changesets.map((changeset, index) => {
            let executionTimeSeconds = 0;
            
            if (index < changesets.length - 1) {
                const currentTime = new Date(changeset.DATEEXECUTED).getTime();
                const nextTime = new Date(changesets[index + 1].DATEEXECUTED).getTime();
                executionTimeSeconds = Math.abs(currentTime - nextTime) / 1000;
            } else {
                executionTimeSeconds = 2;
            }

            return {
                id: changeset.ID,
                author: changeset.AUTHOR,
                executedAt: changeset.DATEEXECUTED,
                executionTimeSeconds: Math.round(executionTimeSeconds * 100) / 100,
                description: changeset.DESCRIPTION,
                execType: changeset.EXECTYPE
            };
        });

        const avgExecutionTime = executionData.reduce((sum, item) => sum + item.executionTimeSeconds, 0) / executionData.length;

        res.json({
            success: true,
            environment: env,
            count: executionData.length,
            averageExecutionTime: Math.round(avgExecutionTime * 100) / 100,
            executions: executionData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/monitoring/author-stats', async (req, res) => {
    const env = req.query.env || 'all';

    try {
        let authorStats = [];

        if (env === 'all') {
            const [devAuthors] = await pools.dev.query(`
                SELECT AUTHOR, COUNT(*) as count, MAX(DATEEXECUTED) as lastChange
                FROM DATABASECHANGELOG GROUP BY AUTHOR
            `);
            const [qaAuthors] = await pools.qa.query(`
                SELECT AUTHOR, COUNT(*) as count, MAX(DATEEXECUTED) as lastChange
                FROM DATABASECHANGELOG GROUP BY AUTHOR
            `);
            const [prodAuthors] = await pools.prod.query(`
                SELECT AUTHOR, COUNT(*) as count, MAX(DATEEXECUTED) as lastChange
                FROM DATABASECHANGELOG GROUP BY AUTHOR
            `);

            const allAuthors = [...devAuthors, ...qaAuthors, ...prodAuthors];
            const authorMap = {};

            allAuthors.forEach(record => {
                if (!authorMap[record.AUTHOR]) {
                    authorMap[record.AUTHOR] = {
                        author: record.AUTHOR,
                        totalChangesets: 0,
                        lastChange: record.lastChange
                    };
                }
                authorMap[record.AUTHOR].totalChangesets += record.count;
                
                if (new Date(record.lastChange) > new Date(authorMap[record.AUTHOR].lastChange)) {
                    authorMap[record.AUTHOR].lastChange = record.lastChange;
                }
            });

            authorStats = Object.values(authorMap).sort((a, b) => b.totalChangesets - a.totalChangesets);

        } else {
            const pool = pools[env];
            if (!pool) {
                return res.status(400).json({ success: false, error: 'Invalid environment' });
            }

            const [authors] = await pool.query(`
                SELECT 
                    AUTHOR,
                    COUNT(*) as totalChangesets,
                    MAX(DATEEXECUTED) as lastChange,
                    MIN(DATEEXECUTED) as firstChange
                FROM DATABASECHANGELOG 
                GROUP BY AUTHOR
                ORDER BY totalChangesets DESC
            `);

            authorStats = authors.map(a => ({
                author: a.AUTHOR,
                totalChangesets: a.totalChangesets,
                lastChange: a.lastChange,
                firstChange: a.firstChange
            }));
        }

        res.json({
            success: true,
            environment: env,
            count: authorStats.length,
            authors: authorStats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/monitoring/deployment-frequency', async (req, res) => {
    const days = parseInt(req.query.days) || 30;

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const frequency = {
            dev: { count: 0, dates: [] },
            qa: { count: 0, dates: [] },
            prod: { count: 0, dates: [] }
        };

        for (const [env, pool] of Object.entries(pools)) {
            const [deployments] = await pool.query(`
                SELECT DATE(DATEEXECUTED) as deployDate, COUNT(*) as count
                FROM DATABASECHANGELOG
                WHERE DATEEXECUTED >= ?
                GROUP BY DATE(DATEEXECUTED)
                ORDER BY deployDate DESC
            `, [cutoffDateStr]);

            frequency[env].count = deployments.reduce((sum, d) => sum + d.count, 0);
            frequency[env].dates = deployments.map(d => ({
                date: d.deployDate,
                changesets: d.count
            }));
        }

        const totalDeployments = frequency.dev.count + frequency.qa.count + frequency.prod.count;
        const deploymentsPerDay = totalDeployments / days;

        res.json({
            success: true,
            period: `Last ${days} days`,
            totalDeployments,
            deploymentsPerDay: Math.round(deploymentsPerDay * 100) / 100,
            byEnvironment: frequency,
            metrics: {
                mostActiveEnv: Object.entries(frequency).sort((a, b) => b[1].count - a[1].count)[0][0],
                avgChangesetsPerDeployment: Math.round((totalDeployments / (
                    frequency.dev.dates.length + frequency.qa.dates.length + frequency.prod.dates.length
                )) * 100) / 100
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/monitoring/success-rate', async (req, res) => {
    const env = req.query.env || 'all';

    try {
        let totalExecutions = 0;
        let successfulExecutions = 0;
        let failedExecutions = 0;
        let reranExecutions = 0;

        const envList = env === 'all' ? ['dev', 'qa', 'prod'] : [env];

        for (const envName of envList) {
            const pool = pools[envName];
            if (!pool) continue;

            const [stats] = await pool.query(`
                SELECT EXECTYPE, COUNT(*) as count
                FROM DATABASECHANGELOG
                GROUP BY EXECTYPE
            `);

            stats.forEach(stat => {
                totalExecutions += stat.count;
                if (stat.EXECTYPE === 'EXECUTED') {
                    successfulExecutions += stat.count;
                } else if (stat.EXECTYPE === 'RERAN') {
                    reranExecutions += stat.count;
                } else if (stat.EXECTYPE === 'FAILED') {
                    failedExecutions += stat.count;
                }
            });
        }

        const successRate = totalExecutions > 0 
            ? Math.round((successfulExecutions / totalExecutions) * 100 * 100) / 100
            : 100;

        res.json({
            success: true,
            environment: env,
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            reranExecutions,
            successRate: successRate,
            failureRate: Math.round((failedExecutions / totalExecutions) * 100 * 100) / 100 || 0,
            rerunRate: Math.round((reranExecutions / totalExecutions) * 100 * 100) / 100 || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/monitoring/audit-trail', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const env = req.query.env || 'all';

    try {
        let auditEntries = [];
        const envList = env === 'all' ? ['dev', 'qa', 'prod'] : [env];

        for (const envName of envList) {
            const pool = pools[envName];
            if (!pool) continue;

            const [entries] = await pool.query(`
                SELECT 
                    ID, AUTHOR, FILENAME, DATEEXECUTED,
                    ORDEREXECUTED, EXECTYPE, DESCRIPTION, DEPLOYMENT_ID
                FROM DATABASECHANGELOG
                ORDER BY DATEEXECUTED DESC
                LIMIT ?
            `, [limit]);

            auditEntries.push(...entries.map(e => ({
                ...e,
                environment: envName.toUpperCase()
            })));
        }

        auditEntries.sort((a, b) => new Date(b.DATEEXECUTED) - new Date(a.DATEEXECUTED));
        auditEntries = auditEntries.slice(0, limit);

        res.json({
            success: true,
            environment: env,
            count: auditEntries.length,
            auditTrail: auditEntries
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Liquibase API Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     🗄️  Liquibase API Server Running                       ║
║     Port: ${PORT}                                          ║
║     Status: ✅ READY                                        ║
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