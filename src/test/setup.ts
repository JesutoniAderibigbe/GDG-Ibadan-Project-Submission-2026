import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement Blob URLs; the media upload flow uses
// URL.createObjectURL for previews, so stub it for every test.
Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock-url', writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true });
