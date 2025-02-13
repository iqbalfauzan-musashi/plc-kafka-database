// src/services/modbus-service.js
const Modbus = require('jsmodbus');
const net = require('net');
const { modbusConfig } = require('../../config/modbus.config');
const logger = require('../utils/logger');

class ModbusService {
    constructor() {
        this.socket = new net.Socket();
        this.client = new Modbus.client.TCP(this.socket);
        this.lastData = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(modbusConfig.port, modbusConfig.host, () => {
                logger.info('Connected to PLC');
                resolve();
            });
            this.socket.on('error', (err) => {
                logger.error('PLC connection error:', err);
                reject(err);
            });
        });
    }

    async readData() {
        try {
            const { startAddress, length } = modbusConfig.registers;
            const response = await this.client.readHoldingRegisters(startAddress, length);
            const values = response.response._body._valuesAsArray;
            
            const Status = values[0];
            const Counter = values[2];

            let isUpdate = 1;
            if (this.lastData != null) {
                if (this.lastData.Status === Status && this.lastData.Counter === Counter) {
                    isUpdate = 0;
                }
            }

            this.lastData = { Status, Counter };

            return {
                machine_code: modbusConfig.machineCode,
                data: values,
                is_update: isUpdate
            };
        } catch (error) {
            logger.error('Error reading Modbus data:', error);
            throw error;
        }
    }

    disconnect() {
        this.socket.end();
        logger.info('Disconnected from PLC');
    }
}

module.exports = ModbusService;
