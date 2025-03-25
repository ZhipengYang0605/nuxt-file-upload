<template>
  <div class="upload">
    <input type="file" @change="handleFileChange" />
    <button class="button-base upload-button" @click="uploadFile" :disabled="uploading">
      {{ uploading ? '上传中...' : '点击上传' }}
    </button>
    <button class="button-base upload-button" @click="cancelUpload">取消上传</button>
    <button class="button-base upload-button" @click="uploadFile">继续上传</button>
    <div class="upload-progress">
      整体上传进度: {{ progress.toFixed(0) }}%
      <div class="upload-progress__bar">
        <div :style="{ width: `${progress}%` }" class="upload-progress__bar-fill"></div>
      </div>
    </div>

    <div v-if="uploadError">
      上传出错: {{ uploadError }}
    </div>
  </div>
</template>

<script lang="ts">
import axios from 'axios';
import SparkMD5 from 'spark-md5';

export default {
  name: 'FileUpload',
  setup() {
    const file = ref<File | null>(null);
    const uploading = ref(false);
    const progress = ref(0);
    const uploadError = ref<string | null>(null);
    const fileHash = ref<string>('');
    const uploadedChunks = ref<number[]>([]);

    const reqControllerQueue = new Set<AbortController>();
    // 选择文件
    const handleFileChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        file.value = target.files[0];
        progress.value = 0;
        uploadError.value = null;
      }
    };

    // 计算文件的 MD5 哈希值
    const calculateFileHash = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const chunkSize = 2 * 1024 * 1024; // 2MB
        const chunks = Math.ceil(file.size / chunkSize);
        const spark = new SparkMD5.ArrayBuffer();
        const fileReader = new FileReader();

        let currentChunk = 0;

        fileReader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result) {
            spark.append(e.target.result as ArrayBuffer);
            currentChunk++;

            if (currentChunk < chunks) {
              loadNext();
            } else {
              resolve(spark.end());
            }
          }
        };

        const loadNext = () => {
          const start = currentChunk * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          fileReader.readAsArrayBuffer(file.slice(start, end));
        };

        loadNext();
      });
    };

    const mergeChunk = async ({
      fileHash,
      fileName,
      totalChunks,
    }: {
      fileHash: string;
      fileName: string;
      totalChunks: number;
    }) => {
      await axios.post('/api/mergeChunks', {
        fileHash,
        fileName,
        totalChunks
      });
    }

    const cancelUpload = () => {
      reqControllerQueue.forEach(controller => {
        controller.abort();
      });
    }

    // 上传文件
    const uploadFile = async () => {
      if (!file.value) {
        alert('请选择一个文件！');
        return;
      }

      uploading.value = true;
      uploadError.value = null;

      try {
        // 计算文件哈希值
        if (!fileHash.value) {
          fileHash.value = await calculateFileHash(file.value);
        }
        
        // 检查文件是否已存在（秒传）
        const { data } = await axios.post<{ exists: boolean }>('/api/checkFile', {
          fileHash: fileHash.value,
          fileName: file.value.name,
        });

        if (data.exists) {
          alert('文件已存在，无需再传！');
          progress.value = 100;
          return;
        }

        // 获取已上传的分片
        const { data: uploadedChunksData } = await axios.post<number[]>('/api/getUploadedChunks', {
          fileHash: fileHash.value,
        });

        uploadedChunks.value = uploadedChunksData;

        // 分片上传
        const chunkSize = 2 * 1024 * 1024; // 2MB
        const totalChunks = Math.ceil(file.value.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          if (uploadedChunks.value.includes(i)) {
            progress.value = ((i + 1) / totalChunks) * 100;
            continue; // 跳过已上传的分片
          }

          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.value.size);
          const chunk = file.value.slice(start, end);

          const formData = new FormData();
          formData.append('file', chunk);
          formData.append('chunkIndex', i.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('fileHash', fileHash.value);
          formData.append('fileName', file.value.name);

          const controller = new AbortController();
          reqControllerQueue.add(controller);
          await axios.post('/api/uploadChunk', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              progress.value = ((i + progressEvent.loaded / (progressEvent.total ?? 1)) / totalChunks) * 100;
            },
            signal: controller.signal,
          });
          reqControllerQueue.delete(controller);
          uploadedChunks.value.push(i); // 记录已上传的分片
        }

        alert('文件上传成功!');

        mergeChunk({
          totalChunks,
          fileName: file.value.name,
          fileHash: fileHash.value
        });
      } catch (error: any) {
        uploadError.value = error.message || 'Upload failed. Please try again.';
      } finally {
        uploading.value = false;
      }
    };

    return {
      file,
      uploading,
      progress,
      uploadError,
      handleFileChange,
      uploadFile,
      cancelUpload,
    };
  },
};
</script>

<style lang="postcss" scoped>
.upload .button-base {
  height: 60px;
  width: 120px;
  border-radius: 8px;
  background: khaki;
  color: black;
  line-height: 60px;
  text-align: center;
  border: none;
  cursor: pointer;
  font-size: 20px;

  &:not(:last-child) {
    margin-right: 24px;
  }

  &:active {
    opacity: 0.6;
  }
}

.upload-progress__bar {
  height: 20px;
  border-radius: 4px;
  background: lightgray;
  width: 600px;
  overflow: hidden;

  .upload-progress__bar-fill {
    height: 100%;
    background-color: lightcoral;
  }
}
</style>>