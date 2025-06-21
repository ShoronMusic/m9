export async function loadChunkedData(dataType, chunkNumber) {
  try {
    const response = await fetch(`/data/${dataType}-chunks/chunk_${chunkNumber}.json`);
    if (!response.ok) throw new Error(`Failed to load chunk ${chunkNumber}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${dataType} chunk ${chunkNumber}:`, error);
    return null;
  }
}

export async function loadDataIndex(dataType) {
  try {
    const response = await fetch(`/data/${dataType}-chunks/index.json`);
    if (!response.ok) throw new Error(`Failed to load index for ${dataType}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${dataType} index:`, error);
    return null;
  }
}

export async function loadAllChunks(dataType) {
  const index = await loadDataIndex(dataType);
  if (!index) return null;

  const chunks = [];
  for (let i = 1; i <= index.totalChunks; i++) {
    const chunk = await loadChunkedData(dataType, i);
    if (chunk) chunks.push(...chunk);
  }

  return chunks;
}

export async function loadChunkedDataByRange(dataType, start, end) {
  const index = await loadDataIndex(dataType);
  if (!index) return null;

  const startChunk = Math.floor(start / index.chunkSize) + 1;
  const endChunk = Math.ceil(end / index.chunkSize);
  
  const chunks = [];
  for (let i = startChunk; i <= endChunk; i++) {
    const chunk = await loadChunkedData(dataType, i);
    if (chunk) chunks.push(...chunk);
  }

  return chunks.slice(start % index.chunkSize, end % index.chunkSize || undefined);
} 