// config/modbus.config.js
const modbusConfig = {
  host: '10.42.46.1',
  port: 502,
  machineCode: '45051',
  readInterval: 2000, // 2 seconds
  registers: {
    startAddress: 45,
    length: 3
  }
};

module.exports = { modbusConfig };