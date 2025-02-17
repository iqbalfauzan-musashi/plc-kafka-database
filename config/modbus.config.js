// config/modbus.config.js
const modbusConfig = {
  host: '10.42.46.2',
  port: 502,
  machineCode: '45051',
  readInterval: 2000,
  registers: {
    startAddress: 45,
    length: 3
  },
  
  reconnectDelay: 5000,
  connectionTimeout: 5000,
  maxRetries: 5
};

module.exports = { modbusConfig };

