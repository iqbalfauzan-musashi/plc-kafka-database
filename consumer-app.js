// consumer-app.js
const MachineConsumer = require("./consumer/machine-consumer");

async function runConsumer() {
  const consumer = new MachineConsumer();

  try {
    await consumer.connect();
    await consumer.start();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down consumer...");
      await consumer.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error("Consumer error:", error);
    await consumer.disconnect();
    process.exit(1);
  }
}

runConsumer().catch(console.error);
