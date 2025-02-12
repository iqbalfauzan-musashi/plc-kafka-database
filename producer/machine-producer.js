// producer/machine-producer.js
const { Kafka } = require("kafkajs");
const { kafkaConfig } = require("../config/kafka.config");
const DataGenerator = require("../services/data-generator");

class MachineProducer {
  constructor() {
    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer();
  }

  async connect() {
    await this.producer.connect();
    console.log("Producer connected to Kafka");
  }

  async sendData(machineCode) {
    try {
      const data = DataGenerator.generateMachineData(machineCode);

      await this.producer.send({
        topic: "machine-data",
        messages: [
          {
            key: machineCode,
            value: JSON.stringify(data),
          },
        ],
      });

      console.log(
        `Data sent for machine ${machineCode}:`,
        JSON.stringify(data)
      );
      return true;
    } catch (error) {
      console.error(`Error sending data for machine ${machineCode}:`, error);
      return false;
    }
  }

  async disconnect() {
    await this.producer.disconnect();
    console.log("Producer disconnected");
  }
}

module.exports = MachineProducer;
