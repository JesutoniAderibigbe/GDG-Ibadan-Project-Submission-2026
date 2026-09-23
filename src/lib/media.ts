// Client-side media handling for project submissions.
//
// Compression itself happens server-side via Cloudinary's own pipeline
// (see optimizedMediaUrl below) — that's a purpose-built media pipeline and
// does a much better job than a browser canvas ever could, especially for
// video, which can't be re-encoded reliably in-browser without a heavy WASM
// decoder. The client's job is just to reject obviously-oversized files
// before spending the user's upload bandwidth (and our Cloudinary quota).

export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_VIDEO_BYTES = 75 * 1024 * 1024; // 75MB
export const MAX_VIDEO_DURATION_SECONDS = 90;

export type MediaType = 'image' | 'video';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

export function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

/** Reads a video file's duration in seconds without uploading it. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata.'));
    };
  });
}

/**
 * Validates a selected media file. Throws a user-facing Error message on
 * anything that fails the checks; resolves to the detected media type.
 */
export async function validateMediaFile(file: File): Promise<MediaType> {
  const mediaType = getMediaType(file);
  if (!mediaType) {
    throw new Error('Please choose an image or video file.');
  }

  if (mediaType === 'image') {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      throw new Error(`Image is too large (max ${MAX_IMAGE_INPUT_BYTES / (1024 * 1024)}MB).`);
    }
    return mediaType;
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video is too large (max ${MAX_VIDEO_BYTES / (1024 * 1024)}MB). Trim or compress it before uploading.`);
  }
  const duration = await getVideoDuration(file);
  if (Number.isFinite(duration) && duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(`Video is too long (max ${MAX_VIDEO_DURATION_SECONDS}s). Trim it before uploading.`);
  }
  return mediaType;
}

/** Uploads a file to Cloudinary's unsigned upload endpoint, reporting progress. */
export function uploadToCloudinary(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return Promise.reject(new Error('Media uploads are not configured yet — ask an organizer to set up Cloudinary.'));
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url as string);
        } catch {
          reject(new Error('Upload succeeded but the response was unreadable.'));
        }
      } else {
        reject(new Error('Upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(formData);
  });
}

/** Inserts Cloudinary's automatic quality/format optimization into a delivery URL. */
export function optimizedMediaUrl(url: string): string {
  return url.replace('/upload/', '/upload/q_auto,f_auto/');
}
