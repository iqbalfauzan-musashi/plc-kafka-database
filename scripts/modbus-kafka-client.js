// scripts/modbus-kafka-client.js
const ModbusService = require('../src/services/modbus-service');
const MachineProducer = require('../src/producer/machine-producer');
const { modbusConfig } = require('../config/modbus.config');
const logger = require('../src/utils/logger');

class ModbusKafkaClient {
    constructor() {
        this.modbusService = new ModbusService();
        this.producer = new MachineProducer();
        this.readingInterval = null;
        this.isRunning = false;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 5;
        this.watchdogInterval = null;
    }

    async init() {
        try {
            await this.producer.connect();
            await this.modbusService.connect();
            this.startReading();
            this.setupGracefulShutdown();
            this.isRunning = true;
            logger.info('ModbusKafkaClient initialized successfully');
        } catch (error) {
            logger.error('Initialization error:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    async startReading() {
        if (this.readingInterval) {
            clearInterval(this.readingInterval);
        }

        this.readingInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                const data = await this.modbusService.readData();
                
                if (data.is_update === 1) {
                    const success = await this.producer.sendData(data.machine_code, data);
                    if (success) {
                        this.consecutiveErrors = 0;
                        logger.info(`Data successfully sent to Kafka for machine ${data.machine_code}`);
                    } else {
                        throw new Error('Failed to send data to Kafka');
                    }
                } else {
                    logger.debug('No new data to send - values unchanged');
                }
            } catch (error) {
                this.consecutiveErrors++;
                logger.error(`Error in reading/sending cycle (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error);

                if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                    logger.error(`Max consecutive errors (${this.maxConsecutiveErrors}) reached. Restarting client...`);
                    await this.restart();
                }
            }
        }, modbusConfig.readInterval);

        this.setupWatchdog();
    }

    setupWatchdog() {
        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
        }

        this.watchdogInterval = setInterval(() => {
            if (this.readingInterval._idleTimeout === -1) {
                logger.error('Reading interval stopped. Restarting...');
                this.startReading();
            }
        }, modbusConfig.readInterval * 2);
    }

    async restart() {
        logger.info('Restarting client...');
        await this.cleanup();
        
        // Wait before reconnecting
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
            await this.init();
            this.consecutiveErrors = 0;
            logger.info('Client successfully restarted');
        } catch (error) {
            logger.error('Failed to restart client:', error);
            process.exit(1);
        }
    }

    async cleanup() {
        this.isRunning = false;
        
        if (this.readingInterval) {
            clearInterval(this.readingInterval);
            this.readingInterval = null;
        }

        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
        }

        await this.producer.disconnect();
        this.modbusService.disconnect();
        logger.info('Cleanup completed');
    }

    setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT signal. Shutting down gracefully...');
            await this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM signal. Shutting down gracefully...');
            await this.cleanup();
            process.exit(0);
        });

        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught exception:', error);
            await this.cleanup();
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            await this.cleanup();
            process.exit(1);
        });
    }
}

// Create and start the client
const client = new ModbusKafkaClient();
client.init().catch(error => {
    logger.error('Failed to start client:', error);
    process.exit(1);
});