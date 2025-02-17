// config/machines.config.js
const machinesConfig = [
  {
    machineCode: '45051',
    host: '10.42.46.1',
    port: 502,
    registers: {
      startAddress: 45,
      length: 3
    }
  },
  {
    machineCode: '45045',
    host: '10.42.46.3',
    port: 502,
    registers: {
      startAddress: 45,
      length: 3
    }
  },
  {
    machineCode: '45044',
    host: '10.42.46.4',
    port: 502,
    registers: {
      startAddress: 45,
      length: 3
    }
  },
  {
    machineCode: '45047',
    host: '10.42.46.5',
    port: 502,
    registers: {
      startAddress: 45,
      length: 3
    }
  }
];

const globalConfig = {
  readInterval: 2000,
  reconnectDelay: 5000,
  connectionTimeout: 5000,
  maxRetries: 5
};

module.exports = { machinesConfig, globalConfig };
