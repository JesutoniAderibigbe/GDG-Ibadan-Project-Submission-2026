import { describe, it, expect } from 'vitest';
import { getMediaType, optimizedMediaUrl, MAX_VIDEO_BYTES, MAX_IMAGE_INPUT_BYTES } from '../media';

function makeFile(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('getMediaType', () => {
  it('classifies image mime types as image', () => {
    expect(getMediaType(makeFile('a.png', 'image/png'))).toBe('image');
    expect(getMediaType(makeFile('a.jpg', 'image/jpeg'))).toBe('image');
  });

  it('classifies video mime types as video', () => {
    expect(getMediaType(makeFile('a.mp4', 'video/mp4'))).toBe('video');
  });

  it('returns null for unsupported types', () => {
    expect(getMediaType(makeFile('a.pdf', 'application/pdf'))).toBeNull();
  });
});

describe('size limits', () => {
  it('caps video uploads at 75MB', () => {
    expect(MAX_VIDEO_BYTES).toBe(75 * 1024 * 1024);
  });

  it('caps raw image uploads at 25MB', () => {
    expect(MAX_IMAGE_INPUT_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('optimizedMediaUrl', () => {
  it('inserts Cloudinary auto quality/format params into the delivery URL', () => {
    expect(optimizedMediaUrl('https://res.cloudinary.com/demo/image/upload/v1700000000/media.jpg'))
      .toBe('https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/v1700000000/media.jpg');
  });

  it('leaves non-Cloudinary-shaped URLs unchanged', () => {
    const url = 'https://example.com/no-upload-segment/media.jpg';
    expect(optimizedMediaUrl(url)).toBe(url);
  });
});
