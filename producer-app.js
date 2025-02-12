// producer-app.js
const { machineCodes } = require("./data/machine-codes");
const MachineProducer = require("./producer/machine-producer");

async function runProducer() {
  const producer = new MachineProducer();
  await producer.connect();

  let currentIndex = 0;
  const batchSize = 10; // Process 10 machines at a time
  const delayBetweenBatches = 1000; // 1 second delay between batches

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down producer...");
    await producer.disconnect();
    process.exit(0);
  });

  // Start sending data in batches
  while (true) {
    const batch = machineCodes.slice(currentIndex, currentIndex + batchSize);

    for (const machineCode of batch) {
      await producer.sendData(machineCode);
      // Small delay between individual machines
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    currentIndex = (currentIndex + batchSize) % machineCodes.length;
    await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
  }
}

runProducer().catch(console.error);
