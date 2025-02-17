// scripts/producer-app.js
const ModbusService = require('../src/services/modbus-service');
const MachineProducer = require('../src/producer/machine-producer');
const logger = require('../src/utils/logger');
const { machinesConfig, globalConfig } = require('../config/machines.config');

class ProducerApp {
    constructor() {
        this.machines = new Map();
        this.producer = new MachineProducer();
        this.isRunning = false;
        this.pollingInterval = null;
    }

    async init() {
        try {
            // Connect to Kafka
            await this.producer.connect();
            
            // Initialize all machines
            for (const config of machinesConfig) {
                const machine = {
                    service: new ModbusService(config),
                    config: config,
                    consecutiveErrors: 0
                };
                this.machines.set(config.machineCode, machine);
            }

            // Connect all machines
            const connections = Array.from(this.machines.values()).map(
                machine => machine.service.connect()
            );
            await Promise.all(connections);

            this.isRunning = true;
            
            // Start continuous polling
            this.startPolling();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            logger.info('Producer initialized successfully');
        } catch (error) {
            logger.error('Producer initialization error:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            if (!this.isRunning) return;

            for (const [machineCode, machine] of this.machines) {
                try {
                    if (!machine.service.isConnected) {
                        continue;
                    }

                    // Read data from PLC
                    const data = await machine.service.readData();
                    
                    // Send data to Kafka if valid
                    if (data) {
                        const success = await this.producer.sendData(machineCode, data);
                        if (success) {
                            machine.consecutiveErrors = 0;
                            logger.info(`Data sent successfully for machine ${machineCode}`);
                        } else {
                            throw new Error('Failed to send data to Kafka');
                        }
                    }
                } catch (error) {
                    machine.consecutiveErrors++;
                    logger.error(`Error in machine ${machineCode} (${machine.consecutiveErrors}/${globalConfig.maxRetries}):`, error);

                    if (machine.consecutiveErrors >= globalConfig.maxRetries) {
                        await this.restartMachine(machineCode);
                    }
                }
            }
        }, globalConfig.readInterval);
    }

    async restartMachine(machineCode) {
        const machine = this.machines.get(machineCode);
        if (!machine) return;

        logger.info(`Restarting machine ${machineCode}...`);
        machine.service.disconnect();
        
        // Wait before reconnecting
        await new Promise(resolve => setTimeout(resolve, globalConfig.reconnectDelay));
        
        try {
            await machine.service.connect();
            machine.consecutiveErrors = 0;
            logger.info(`Machine ${machineCode} successfully restarted`);
        } catch (error) {
            logger.error(`Failed to restart machine ${machineCode}:`, error);
        }
    }

    async cleanup() {
        this.isRunning = false;
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        try {
            // Disconnect all machines
            const disconnections = Array.from(this.machines.values()).map(
                machine => machine.service.disconnect()
            );
            await Promise.all(disconnections);
            
            await this.producer.disconnect();
            logger.info('Producer cleanup completed');
        } catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }

    setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT signal. Shutting down producer gracefully...');
            await this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM signal. Shutting down producer gracefully...');
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

// Create and start the producer
const producerApp = new ProducerApp();
producerApp.init().catch(error => {
    logger.error('Failed to start producer:', error);
    process.exit(1);
});