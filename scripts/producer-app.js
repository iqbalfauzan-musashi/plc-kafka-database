// scripts/producer-app.js
const ModbusService = require('../src/services/modbus-service');
const MachineProducer = require('../src/producer/machine-producer');
const logger = require('../src/utils/logger');
const { modbusConfig } = require('../config/modbus.config');

async function runProducer() {
    const modbusService = new ModbusService();
    const producer = new MachineProducer();

    try {
        // Koneksi ke PLC dan Kafka
        await modbusService.connect();
        await producer.connect();

        // Baca data real dari PLC
        const realData = await modbusService.readData();
        await producer.sendData(realData.machine_code, realData);

        process.on('SIGINT', async () => {
            logger.info('Shutting down producer...');
            modbusService.disconnect();
            await producer.disconnect();
            process.exit(0);
        });
    } catch (error) {
        logger.error('Producer error:', error);
        modbusService.disconnect();
        await producer.disconnect();
        process.exit(1);
    }
}

runProducer().catch(error => {
    logger.error('Failed to start producer:', error);
    process.exit(1);
});