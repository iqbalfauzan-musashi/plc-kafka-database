// data/machine-codes.js
// We'll create an array of machine codes
const machineCodes = Array.from({ length: 400 }, (_, i) => {
  // Generating machine codes from 12000 to 12399
  return String(12000 + i);
});

module.exports = { machineCodes };
