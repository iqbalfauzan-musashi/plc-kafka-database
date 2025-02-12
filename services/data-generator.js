// services/data-generator.js
class DataGenerator {
  static generateMachineData(machineCode) {
    return {
      machine_code: machineCode,
      // Generating three values as per your example
      data: [
        Math.floor(Math.random() * 100), // First value: 0-99
        Math.floor(Math.random() * 100), // Second value: 0-99
        Math.floor(Math.random() * 100000), // Third value: 0-99999
      ],
      is_update: 0, // Setting is_update to 0 as per your example
    };
  }
}

module.exports = DataGenerator;
