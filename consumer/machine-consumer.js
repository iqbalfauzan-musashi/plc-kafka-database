// consumer/machine-consumer.js
const { Kafka } = require("kafkajs");
const sql = require("mssql");
const { kafkaConfig } = require("../config/kafka.config");
const { dbConfig } = require("../config/database.config");

class MachineConsumer {
  constructor() {
    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer({ groupId: "iot-group" });
    this.pool = null;
  }

  async connect() {
    // Connect to Kafka
    await this.consumer.connect();
    console.log("Consumer connected to Kafka");

    // Connect to database
    this.pool = await sql.connect(dbConfig);
    console.log("Connected to database");
  }

  async saveToDatabase(machineCode, data, isUpdate) {
    const request = this.pool.request();
    const result = await request
      .input("machine_code", sql.NVarChar, machineCode)
      .input("data", sql.NVarChar, JSON.stringify(data))
      .input("is_update", sql.Bit, isUpdate)
      .input("created_at", sql.DateTime, new Date()).query(`
                INSERT INTO MachineData (MachineCode, Data, IsUpdate, CreatedAt)
                VALUES (@machine_code, @data, @is_update, @created_at);
                SELECT SCOPE_IDENTITY() AS id;
            `);

    return result.recordset[0].id;
  }

  async start() {
    await this.consumer.subscribe({
      topic: "machine-data",
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          console.log("Received data:", data);

          await this.saveToDatabase(
            data.machine_code,
            data.data,
            data.is_update
          );

          console.log(`Data saved for machine ${data.machine_code}`);
        } catch (error) {
          console.error("Error processing message:", error);
        }
      },
    });
  }

  async disconnect() {
    await this.consumer.disconnect();
    await sql.close();
    console.log("Consumer disconnected and database connection closed");
  }
}

module.exports = MachineConsumer;
