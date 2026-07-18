const defaultMaxImportBatches = 5;

export function getMaxImportBatches() {
  const value = Number(process.env.MAX_IMPORT_BATCHES);

  if (!Number.isInteger(value) || value < 1) {
    return defaultMaxImportBatches;
  }

  return value;
}
