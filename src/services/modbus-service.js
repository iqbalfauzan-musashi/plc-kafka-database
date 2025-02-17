//src/services/modbus-service.js
const Modbus = require('jsmodbus');
const net = require('net');
const logger = require('../utils/logger');
const { globalConfig } = require('../../config/machines.config');

class ModbusService {
  constructor(config) {
    this.config = config;
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket);
    this.isConnected = false;
    this.connectionTimeout = null;
    this.lastData = null;
    this.retryCount = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
      }

      this.socket.on('connect', () => {
        logger.info(`Connected to PLC ${this.config.machineCode} at ${this.config.host}`);
        this.isConnected = true;
        this.retryCount = 0;
        resolve();
      });

      this.socket.on('error', (err) => {
        logger.error(`PLC ${this.config.machineCode} connection error:`, err);
        this.handleDisconnection();
      });

      this.socket.on('close', () => {
        logger.info(`PLC ${this.config.machineCode} connection closed`);
        this.handleDisconnection();
      });

      try {
        this.socket.connect({
          host: this.config.host,
          port: this.config.port,
          timeout: globalConfig.connectionTimeout
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleDisconnection() {
    this.isConnected = false;
    this.socket.destroy();

    if (this.retryCount < globalConfig.maxRetries) {
      this.retryCount++;
      this.connectionTimeout = setTimeout(() => {
        logger.info(`Attempting to reconnect to PLC ${this.config.machineCode} (Attempt ${this.retryCount}/${globalConfig.maxRetries})...`);
        this.connect().catch(err => {
          logger.error(`Reconnection attempt failed for ${this.config.machineCode}:`, err);
        });
      }, globalConfig.reconnectDelay);
    }
  }

  async readData() {
    if (!this.isConnected) {
      throw new Error(`Not connected to PLC ${this.config.machineCode}`);
    }

    try {
      const { startAddress, length } = this.config.registers;
      const response = await this.client.readHoldingRegisters(startAddress, length);

      if (!response || !response.response || !response.response._body) {
        throw new Error(`Invalid response from PLC ${this.config.machineCode}`);
      }

      const values = response.response._body._valuesAsArray;

      if (!Array.isArray(values) || values.length < 3) {
        throw new Error(`Invalid data format from PLC ${this.config.machineCode}`);
      }

      const Status = values[0];
      const Counter = values[2];

      let isUpdate = 1;
      if (this.lastData !== null) {
        if (this.lastData.Status === Status && this.lastData.Counter === Counter) {
          isUpdate = 0;
        }
      }

      this.lastData = { Status, Counter };

      return {
        machine_code: this.config.machineCode,
        data: values,
        is_update: isUpdate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error reading Modbus data from ${this.config.machineCode}:`, error);
      if (error.message.includes('ECONNRESET') || error.message.includes('Port Not Open')) {
        this.handleDisconnection();
      }
      throw error;
    }
  }

  disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    if (this.socket) {
      this.socket.destroy();
    }
    this.isConnected = false;
    logger.info(`Disconnected from PLC ${this.config.machineCode}`);
  }
}

module.exports = ModbusService;