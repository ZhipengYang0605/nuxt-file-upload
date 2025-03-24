import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { fileHash, fileName } = body;
  const filePath = path.join(process.cwd(), 'uploads', fileName);

  return {
    exists: fs.existsSync(filePath),
  };
});