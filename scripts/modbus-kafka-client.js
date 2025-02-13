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
    }

    async init() {
        try {
            await this.producer.connect();
            await this.modbusService.connect();
            this.startReading();
            this.setupGracefulShutdown();
        } catch (error) {
            logger.error('Initialization error:', error);
            process.exit(1);
        }
    }

    startReading() {
        this.readingInterval = setInterval(async () => {
            try {
                const data = await this.modbusService.readData();
                await this.producer.sendData(data.machine_code, data);
            } catch (error) {
                logger.error('Error in reading/sending cycle:', error);
            }
        }, modbusConfig.readInterval);
    }

    setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            clearInterval(this.readingInterval);
            await this.producer.disconnect();
            this.modbusService.disconnect();
            process.exit(0);
        });
    }
}

const client = new ModbusKafkaClient();
client.init().catch(error => {
    logger.error('Failed to start client:', error);
    process.exit(1);
});
