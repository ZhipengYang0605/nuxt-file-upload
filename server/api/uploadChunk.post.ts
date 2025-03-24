import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';
import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  // 创建上传目录（如果不存在）
  const chunksDir = path.join(process.cwd(), 'uploads', 'chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  // 使用 formidable 解析 multipart/form-data
  const form = new IncomingForm({
    uploadDir: chunksDir, // 设置临时上传目录
    keepExtensions: true, // 保留文件扩展名
  });

  // 解析请求
  const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
    form.parse(event.node.req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ fields, files });
    });
  });

  // 获取字段和文件
  const chunkIndex = fields.chunkIndex?.[0]; // 分片索引
  const fileHash = fields.fileHash?.[0]; // 文件哈希值
  const fileName = fields.fileName?.[0]; // 文件名
  const file = files.file?.[0]; // 上传的文件

  if (!chunkIndex || !fileHash || !fileName || !file) {
    return {
      success: false,
      message: 'Missing required fields or file.',
    };
  }

  // 将分片存储到以 fileHash 命名的目录
  const fileHashDir = path.join(chunksDir, fileHash);
  if (!fs.existsSync(fileHashDir)) {
    fs.mkdirSync(fileHashDir, { recursive: true });
  }

  // 移动文件到目标目录
  const chunkPath = path.join(fileHashDir, `${fileName}.part.${chunkIndex}`);
  fs.renameSync(file.filepath, chunkPath);

  return {
    success: true,
    chunkIndex,
    fileHash,
    fileName,
  };
});