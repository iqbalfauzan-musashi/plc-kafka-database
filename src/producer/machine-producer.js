// src/producer/machine-producer.js
const { Kafka } = require("kafkajs");
const { kafkaConfig } = require("../../config/kafka.config");
const logger = require('../utils/logger');

class MachineProducer {
  constructor() {
    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer();
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info("Producer connected to Kafka");
    } catch (error) {
      logger.error("Failed to connect producer:", error);
      throw error;
    }
  }

  async sendData(machineCode, data) {
    if (!this.isConnected) {
      throw new Error('Producer not connected to Kafka');
    }

    try {
      await this.producer.send({
        topic: "machine-data",
        messages: [
          {
            key: machineCode,
            value: JSON.stringify(data),
            timestamp: Date.now()
          }
        ]
      });

      logger.info(`Data sent for machine ${machineCode}:`, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error(`Error sending data for machine ${machineCode}:`, error);
      return false;
    }
  }

  async disconnect() {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info("Producer disconnected");
    } catch (error) {
      logger.error("Error disconnecting producer:", error);
    }
  }
}

module.exports = MachineProducer;