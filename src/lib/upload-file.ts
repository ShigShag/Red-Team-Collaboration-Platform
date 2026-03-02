export interface UploadProgress {
  fileIndex: number;
  loaded: number;
  total: number;
  percent: number;
}

export function uploadFile(
  file: File,
  engagementId: string,
  resourceId: string,
  onProgress: (progress: UploadProgress) => void,
  fileIndex: number
): Promise<{ success: boolean; error?: string; fileId?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // Text fields MUST be appended before file —
    // busboy processes them in order and we need auth fields before the file stream
    formData.append("engagementId", engagementId);
    formData.append("resourceId", resourceId);
    formData.append("filename", file.name);
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress({
          fileIndex,
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          resolve({ success: true, fileId: data.fileId });
        } else {
          resolve({ success: false, error: data.error || "Upload failed" });
        }
      } catch {
        resolve({ success: false, error: "Upload failed" });
      }
    });

    xhr.addEventListener("error", () => {
      resolve({ success: false, error: "Network error" });
    });

    xhr.addEventListener("abort", () => {
      resolve({ success: false, error: "Upload cancelled" });
    });

    xhr.open("POST", "/api/resources/upload");
    xhr.send(formData);
  });
}
