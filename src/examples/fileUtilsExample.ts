/**
 * Example usage of file utilities
 * This file demonstrates how to use the fileUtils functions
 */

import {
  getFileExtension,
  getFileExtensionWithDot,
  hasFileExtension,
  isImageUrl,
  isVideoUrl,
  isAudioUrl,
  getMimeType,
  getFilename,
  getFilenameWithoutExtension,
} from '../utils/fileUtils';

// Example URLs for testing
const testUrls = [
  'https://example.com/image.jpg',
  'https://delivery-us1.bfl.ai/results/2c/8383718ff6fca1/8ff6fca14ee54092a05264e168d6d113/sample.jpeg?se=2025-10-07T10%3A20%3A38Z&sp=r&sv=2024-11-04&sr=b&rsct=image/jpeg&sig=05a5IMFwXThvMr43v2aaOZ6RHB1fTBDifSZb74Sv4Vk%3D',
  'https://example.com/video.mp4',
  'https://example.com/audio.mp3',
  'https://example.com/document.pdf',
  'https://example.com/file',
  'https://example.com/path/to/complex-file-name.png',
];

// Example 1: Basic file extension extraction
export const basicExtensionExample = () => {
  console.log('=== Basic File Extension Examples ===');

  testUrls.forEach(url => {
    const extension = getFileExtension(url);
    const extensionWithDot = getFileExtensionWithDot(url);
    const filename = getFilename(url);
    const filenameWithoutExt = getFilenameWithoutExtension(url);

    console.log(`URL: ${url}`);
    console.log(`  Extension: ${extension}`);
    console.log(`  Extension with dot: ${extensionWithDot}`);
    console.log(`  Filename: ${filename}`);
    console.log(`  Filename without extension: ${filenameWithoutExt}`);
    console.log('---');
  });
};

// Example 2: File type checking
export const fileTypeCheckingExample = () => {
  console.log('=== File Type Checking Examples ===');

  testUrls.forEach(url => {
    const isImage = isImageUrl(url);
    const isVideo = isVideoUrl(url);
    const isAudio = isAudioUrl(url);
    const mimeType = getMimeType(url);

    console.log(`URL: ${url}`);
    console.log(`  Is Image: ${isImage}`);
    console.log(`  Is Video: ${isVideo}`);
    console.log(`  Is Audio: ${isAudio}`);
    console.log(`  MIME Type: ${mimeType}`);
    console.log('---');
  });
};

// Example 3: Extension checking
export const extensionCheckingExample = () => {
  console.log('=== Extension Checking Examples ===');

  const testCases = [
    { url: 'https://example.com/image.jpg', extension: 'jpg' },
    { url: 'https://example.com/image.jpg', extension: '.jpg' },
    { url: 'https://example.com/image.png', extension: 'jpg' },
    { url: 'https://example.com/video.mp4', extension: 'mp4' },
  ];

  testCases.forEach(({ url, extension }) => {
    const hasExt = hasFileExtension(url, extension);
    console.log(`URL: ${url}`);
    console.log(`  Has extension '${extension}': ${hasExt}`);
    console.log('---');
  });
};

// Example 4: Complex URL handling (like BFL delivery URLs)
export const complexUrlExample = () => {
  console.log('=== Complex URL Example ===');

  const complexUrl =
    'https://delivery-us1.bfl.ai/results/2c/8383718ff6fca1/8ff6fca14ee54092a05264e168d6d113/sample.jpeg?se=2025-10-07T10%3A20%3A38Z&sp=r&sv=2024-11-04&sr=b&rsct=image/jpeg&sig=05a5IMFwXThvMr43v2aaOZ6RHB1fTBDifSZb74Sv4Vk%3D';

  console.log(`Complex URL: ${complexUrl}`);
  console.log(`Extension: ${getFileExtension(complexUrl)}`);
  console.log(`Extension with dot: ${getFileExtensionWithDot(complexUrl)}`);
  console.log(`Filename: ${getFilename(complexUrl)}`);
  console.log(
    `Filename without extension: ${getFilenameWithoutExtension(complexUrl)}`
  );
  console.log(`Is Image: ${isImageUrl(complexUrl)}`);
  console.log(`MIME Type: ${getMimeType(complexUrl)}`);
  console.log(`Has JPEG extension: ${hasFileExtension(complexUrl, 'jpeg')}`);
  console.log(`Has JPG extension: ${hasFileExtension(complexUrl, 'jpg')}`);
};

// Example 5: Practical usage in a function
export const processImageUrl = (url: string) => {
  console.log('=== Processing Image URL ===');

  if (!isImageUrl(url)) {
    console.log('Not an image URL');
    return null;
  }

  const extension = getFileExtension(url);
  const filename = getFilename(url);
  const mimeType = getMimeType(url);

  console.log(`Processing image: ${filename}`);
  console.log(`Extension: ${extension}`);
  console.log(`MIME Type: ${mimeType}`);

  return {
    url,
    filename,
    extension,
    mimeType,
    isImage: true,
  };
};

// Example 6: File validation
export const validateFileUrl = (url: string, allowedExtensions: string[]) => {
  const extension = getFileExtension(url);

  if (!extension) {
    return {
      valid: false,
      reason: 'No file extension found',
    };
  }

  const normalizedAllowed = allowedExtensions.map(ext =>
    ext.startsWith('.') ? ext.substring(1) : ext
  );

  if (!normalizedAllowed.includes(extension.toLowerCase())) {
    return {
      valid: false,
      reason: `Extension '${extension}' not allowed. Allowed: ${normalizedAllowed.join(', ')}`,
    };
  }

  return {
    valid: true,
    extension,
    mimeType: getMimeType(url),
  };
};

// Run all examples
export const runAllExamples = () => {
  basicExtensionExample();
  fileTypeCheckingExample();
  extensionCheckingExample();
  complexUrlExample();

  // Process some test URLs
  testUrls.forEach(url => {
    const result = processImageUrl(url);
    if (result) {
      console.log('Processed:', result);
    }
  });

  // Validate files
  const validationResult = validateFileUrl('https://example.com/document.pdf', [
    'jpg',
    'png',
    'pdf',
    'doc',
  ]);
  console.log('Validation result:', validationResult);
};
