// src/producer/machine-producer.js
const { Kafka } = require("kafkajs");
const { kafkaConfig } = require("../../config/kafka.config");
const logger = require('../utils/logger');

class MachineProducer {
    constructor() {
        this.kafka = new Kafka(kafkaConfig);
        this.producer = this.kafka.producer();
    }

    async connect() {
        await this.producer.connect();
        logger.info("Producer connected to Kafka");
    }

    async sendData(machineCode, data) {
        try {
            await this.producer.send({
                topic: "machine-data",
                messages: [
                    {
                        key: machineCode,
                        value: JSON.stringify(data),
                    },
                ],
            });

            logger.info(`Data sent for machine ${machineCode}:`, JSON.stringify(data));
            return true;
        } catch (error) {
            logger.error(`Error sending data for machine ${machineCode}:`, error);
            return false;
        }
    }

    async disconnect() {
        await this.producer.disconnect();
        logger.info("Producer disconnected");
    }
}

module.exports = MachineProducer;