// src/services/modbus-service.js
const Modbus = require('jsmodbus');
const net = require('net');
const { modbusConfig } = require('../../config/modbus.config');
const logger = require('../utils/logger');

class ModbusService {
  constructor() {
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket);
    this.isConnected = false;
    this.reconnectInterval = 5000;
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
        logger.info('Connected to PLC');
        this.isConnected = true;
        this.retryCount = 0;
        resolve();
      });

      this.socket.on('error', (err) => {
        logger.error('PLC connection error:', err);
        this.handleDisconnection();
      });

      this.socket.on('close', () => {
        logger.info('PLC connection closed');
        this.handleDisconnection();
      });

      this.socket.on('timeout', () => {
        logger.error('PLC connection timeout');
        this.handleDisconnection();
      });

      try {
        this.socket.connect({
          host: modbusConfig.host,
          port: modbusConfig.port,
          timeout: modbusConfig.connectionTimeout
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleDisconnection() {
    this.isConnected = false;
    this.socket.destroy();

    if (this.retryCount < modbusConfig.maxRetries) {
      this.retryCount++;
      this.connectionTimeout = setTimeout(() => {
        logger.info(`Attempting to reconnect to PLC (Attempt ${this.retryCount}/${modbusConfig.maxRetries})...`);
        this.connect().catch(err => {
          logger.error('Reconnection attempt failed:', err);
        });
      }, this.reconnectInterval);
    } else {
      logger.error('Max retry attempts reached. Manual intervention required.');
      process.exit(1);
    }
  }

  async readData() {
    if (!this.isConnected) {
      throw new Error('Not connected to PLC');
    }

    try {
      const { startAddress, length } = modbusConfig.registers;
      const response = await this.client.readHoldingRegisters(startAddress, length);

      if (!response || !response.response || !response.response._body) {
        throw new Error('Invalid response from PLC');
      }

      const values = response.response._body._valuesAsArray;

      if (!Array.isArray(values) || values.length < 3) {
        throw new Error('Invalid data format from PLC');
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
        machine_code: modbusConfig.machineCode,
        data: values,
        is_update: isUpdate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error reading Modbus data:', error);
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
    logger.info('Disconnected from PLC');
  }
}

module.exports = ModbusService;