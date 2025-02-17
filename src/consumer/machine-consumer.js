// src/consumer/machine-consumer.js
const { Kafka } = require("kafkajs");
const sql = require("mssql");
const { kafkaConfig } = require("../../config/kafka.config");
const { dbConfig } = require("../../config/database.config");
const logger = require('../utils/logger');
const { OperationTranslator } = require('../utils/operation-codes');

class MachineConsumer {
  constructor() {
    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer({ groupId: "iot-group" });
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.consumer.connect();
      logger.info("Consumer connected to Kafka");

      this.pool = await sql.connect(dbConfig);
      this.isConnected = true;
      logger.info("Connected to database");
    } catch (error) {
      logger.error("Connection error:", error);
      throw error;
    }
  }

  async getMachineName(machineCode) {
    try {
      const request = this.pool.request();
      const result = await request
        .input("machine_code", sql.NVarChar, machineCode)
        .query(`
          SELECT MACHINE_NAME 
          FROM CODE_MACHINE_PRODUCTION 
          WHERE MACHINE_CODE = @machine_code AND IS_SHOW = 1
        `);

      if (result.recordset.length > 0) {
        return result.recordset[0].MACHINE_NAME;
      }
      return 'Unknown Machine';
    } catch (error) {
      logger.error("Error getting machine name:", error);
      return 'Unknown Machine';
    }
  }

  async saveToDatabase(machineCode, data, isUpdate) {
    try {
      const request = this.pool.request();
      const [idOperation, sendPlc, machineCounter] = data;
      const operationName = OperationTranslator.getOperationName(idOperation);
      const machineName = await this.getMachineName(machineCode);

      const result = await request
        .input("machine_code", sql.NVarChar, machineCode)
        .input("machine_name", sql.NVarChar, machineName)
        .input("id_operation", sql.Int, idOperation)
        .input("operation_name", sql.NVarChar, operationName)
        .input("send_plc", sql.Int, sendPlc)
        .input("machine_counter", sql.Int, machineCounter)
        .input("created_at", sql.DateTime, new Date())
        .query(`
          INSERT INTO MACHINE_STATUS_PRODUCTION (
            MachineCode,
            MachineName, 
            ID_OPERATION,
            OPERATION_NAME,
            SEND_PLC, 
            MACHINE_COUNTER, 
            CreatedAt
          )
          VALUES (
            @machine_code,
            @machine_name, 
            @id_operation,
            @operation_name,
            @send_plc, 
            @machine_counter, 
            @created_at
          );
          SELECT SCOPE_IDENTITY() AS id;
        `);

      logger.info(`Data saved to database with ID: ${result.recordset[0].id}`);
      logger.info(`Machine: ${machineName} (${machineCode})`);
      logger.info(`Operation Status: ${operationName} (${idOperation})`);
      return result.recordset[0].id;
    } catch (error) {
      logger.error("Database error:", error);
      throw error;
    }
  }

  async start() {
    if (!this.isConnected) {
      throw new Error('Consumer not connected');
    }

    try {
      await this.consumer.subscribe({
        topic: "machine-data",
        fromBeginning: true
      });

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const data = JSON.parse(message.value.toString());
            logger.info("Received data:", data);

            if (data.is_update === 1) {
              await this.saveToDatabase(
                data.machine_code,
                data.data,
                data.is_update
              );
              logger.info(`Data saved for machine ${data.machine_code}`);
            } else {
              logger.debug(`Skipping duplicate data for machine ${data.machine_code}`);
            }
          } catch (error) {
            logger.error("Error processing message:", error);
          }
        }
      });
    } catch (error) {
      logger.error("Consumer run error:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.consumer.disconnect();
      await sql.close();
      this.isConnected = false;
      logger.info("Consumer disconnected and database connection closed");
    } catch (error) {
      logger.error("Disconnect error:", error);
    }
  }
}

module.exports = MachineConsumer;