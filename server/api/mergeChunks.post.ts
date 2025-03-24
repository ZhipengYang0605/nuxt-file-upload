import fs from 'fs';
import path from 'path';
import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { fileHash, fileName, totalChunks } = body;

  // 分片目录
  const chunksDir = path.join(process.cwd(), 'uploads', 'chunks', fileHash);
  if (!fs.existsSync(chunksDir)) {
    return {
      success: false,
      message: 'Chunks directory not found.',
    };
  }

  // 合并分片
  const outputPath = path.join(process.cwd(), 'uploads', fileName);
  const writeStream = fs.createWriteStream(outputPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunksDir, `${fileName}.part.${i}`);
    if (!fs.existsSync(chunkPath)) {
      return {
        success: false,
        message: `Chunk ${i} not found.`,
      };
    }

    const chunkBuffer = fs.readFileSync(chunkPath);
    writeStream.write(chunkBuffer);
    fs.unlinkSync(chunkPath); // 删除分片
  }

  writeStream.end();
  fs.rmdirSync(chunksDir); // 删除分片目录

  return {
    success: true,
    filePath: outputPath,
  };
});