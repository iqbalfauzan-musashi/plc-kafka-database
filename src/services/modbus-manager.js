//src/services/modbus-manager.js
const ModbusService = require('./modbus-service');
const MachineProducer = require('../producer/machine-producer');
const logger = require('../utils/logger');
const { machinesConfig, globalConfig } = require('../../config/machines.config');

class ModbusManager {
  constructor() {
    this.machines = new Map();
    this.producer = new MachineProducer();
    this.isRunning = false;
  }

  async init() {
    try {
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
      this.startPolling();
      logger.info('ModbusManager initialized successfully');
    } catch (error) {
      logger.error('ModbusManager initialization error:', error);
      await this.cleanup();
      throw error;
    }
  }

  startPolling() {
    setInterval(async () => {
      if (!this.isRunning) return;

      for (const [machineCode, machine] of this.machines) {
        try {
          if (!machine.service.isConnected) {
            continue;
          }

          const data = await machine.service.readData();
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
    await machine.service.disconnect();
    
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
    
    // Disconnect all machines
    const disconnections = Array.from(this.machines.values()).map(
      machine => machine.service.disconnect()
    );
    await Promise.all(disconnections);
    
    await this.producer.disconnect();
    logger.info('ModbusManager cleanup completed');
  }
}

module.exports = ModbusManager;