import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { fileHash } = body;
  const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', fileHash);

  if (fs.existsSync(chunksDir)) {
    const chunks = fs.readdirSync(chunksDir).map((chunk) => {
      const matcher = chunk.match(/\.(\d+)$/)
      return parseInt(matcher?.[1] ?? '0');
    });
    return chunks;
  } else {
    return [];
  }
});