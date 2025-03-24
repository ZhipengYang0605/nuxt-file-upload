import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { fileHash } = body;
  const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', fileHash);

  if (fs.existsSync(chunksDir)) {
    const chunks = fs.readdirSync(chunksDir).map((chunk) => parseInt(chunk.split('.')[1]));
    return chunks;
  } else {
    return [];
  }
});