/**
 * Example usage of FLUX Pro Ultra API routes
 * This file demonstrates how to use the FLUX Pro Ultra image generation endpoints
 */

// Example 1: Basic FLUX Pro Ultra image generation
export const basicFluxProUltraExample = {
  url: 'POST /flux/flux-pro-ultra/generate',
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: {
    prompt: 'A beautiful landscape with mountains and a lake',
    aspect_ratio: '16:9',
    output_format: 'jpeg',
    safety_tolerance: 2,
  },
};

// Example 2: Advanced FLUX Pro Ultra with all parameters
export const advancedFluxProUltraExample = {
  url: 'POST /flux/flux-pro-ultra/generate',
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: {
    prompt: 'A futuristic cityscape at sunset with flying cars and neon lights',
    prompt_upsampling: true,
    seed: 42,
    aspect_ratio: '21:9',
    safety_tolerance: 3,
    output_format: 'png',
    raw: false,
    image_prompt: null,
    image_prompt_strength: 0.1,
    webhook_url: 'https://your-webhook-url.com/callback',
    webhook_secret: 'your-webhook-secret',
    max_polls: 60,
    poll_interval: 2000,
  },
};

// Example 3: Ultra mode with raw processing
export const ultraRawExample = {
  url: 'POST /flux/flux-pro-ultra/generate',
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: {
    prompt:
      'A detailed portrait of a cyberpunk character with intricate details',
    raw: true,
    aspect_ratio: '1:1',
    output_format: 'png',
    safety_tolerance: 1,
  },
};

// Example 4: Image remixing with FLUX Pro Ultra (Base64)
export const imageRemixBase64Example = {
  url: 'POST /flux/flux-pro-ultra/generate',
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: {
    prompt: 'Transform this image into a watercolor painting',
    image_prompt: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...', // Base64 encoded image
    image_prompt_strength: 0.7,
    aspect_ratio: '16:9',
    output_format: 'jpeg',
  },
};

// Example 5: Image remixing with FLUX Pro Ultra (URL - auto-converted to base64)
export const imageRemixUrlExample = {
  url: 'POST /flux/flux-pro-ultra/generate',
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
  body: {
    prompt: 'Transform this image into a watercolor painting',
    image_prompt: 'https://example.com/image.jpg', // Image URL - automatically converted to base64
    image_prompt_strength: 0.7,
    aspect_ratio: '16:9',
    output_format: 'jpeg',
  },
};

// Example 6: Image URL conversion examples
export const imageUrlConversionExamples = {
  // Direct image URL (automatically converted to base64)
  imageUrl: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      prompt: 'Transform this image into a watercolor painting',
      image_prompt: 'https://example.com/photo.jpg', // Will be auto-converted to base64
      image_prompt_strength: 0.7,
    },
    note: 'The image URL will be automatically fetched and converted to base64 format',
  },

  // Base64 data URL (used as-is)
  base64DataUrl: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      prompt: 'Transform this image into a watercolor painting',
      image_prompt: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...', // Used as-is
      image_prompt_strength: 0.7,
    },
    note: 'Base64 data URLs are used directly without conversion',
  },

  // Complex URL with query parameters (auto-converted)
  complexUrl: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      prompt: 'Transform this image into a watercolor painting',
      image_prompt:
        'https://delivery-us1.bfl.ai/results/2c/8383718ff6fca1/sample.jpeg?se=2025-10-07T10%3A20%3A38Z&sp=r&sv=2024-11-04&sr=b&rsct=image/jpeg&sig=05a5IMFwXThvMr43v2aaOZ6RHB1fTBDifSZb74Sv4Vk%3D',
      image_prompt_strength: 0.7,
    },
    note: 'Complex URLs with query parameters are also automatically converted',
  },

  // Supported file formats (now includes more than just images)
  supportedFormats: {
    images: [
      'https://example.com/image.jpg',
      'https://example.com/image.jpeg',
      'https://example.com/image.png',
      'https://example.com/image.gif',
      'https://example.com/image.webp',
      'https://example.com/image.bmp',
      'https://example.com/image.svg',
      'https://example.com/image.tiff',
    ],
    documents: [
      'https://example.com/document.pdf',
      'https://example.com/document.docx',
      'https://example.com/document.txt',
    ],
    archives: [
      'https://example.com/archive.zip',
      'https://example.com/archive.rar',
    ],
    code: [
      'https://example.com/script.js',
      'https://example.com/style.css',
      'https://example.com/data.json',
    ],
  },
};

// Example 7: Async workflow (create request, then poll)
export const asyncWorkflowExample = {
  // Step 1: Create request
  createRequest: {
    url: 'POST /flux/flux-pro-ultra',
    headers: {
      Authorization: 'Bearer your-jwt-token',
      'Content-Type': 'application/json',
    },
    body: {
      prompt: 'A majestic dragon flying over a medieval castle',
      aspect_ratio: '16:9',
      output_format: 'jpeg',
      webhook_url: 'https://your-webhook-url.com/callback',
    },
  },

  // Step 2: Poll for result
  pollResult: {
    url: 'GET /flux/flux-pro-ultra/poll?polling_url=https://api.bfl.ai/v1/queue/status/your-request-id',
    headers: {
      Authorization: 'Bearer your-jwt-token',
    },
  },
};

// Example 7: Different aspect ratios
export const aspectRatioExamples = [
  {
    name: 'Ultra-wide cinematic',
    aspect_ratio: '21:9',
    description: 'Perfect for cinematic shots and landscapes',
  },
  {
    name: 'Standard widescreen',
    aspect_ratio: '16:9',
    description: 'Common for displays and presentations',
  },
  {
    name: 'Square format',
    aspect_ratio: '1:1',
    description: 'Great for social media posts',
  },
  {
    name: 'Portrait orientation',
    aspect_ratio: '9:16',
    description: 'Mobile-friendly vertical format',
  },
  {
    name: 'Classic 4:3',
    aspect_ratio: '4:3',
    description: 'Traditional photography format',
  },
];

// Example 8: Safety tolerance levels
export const safetyToleranceExamples = [
  {
    level: 0,
    description: 'Most strict - blocks most content',
    use_case: 'Family-friendly applications',
  },
  {
    level: 2,
    description: 'Default - balanced moderation',
    use_case: 'General purpose applications',
  },
  {
    level: 4,
    description: 'Moderate - allows some artistic content',
    use_case: 'Creative applications',
  },
  {
    level: 6,
    description: 'Least strict - minimal filtering',
    use_case: 'Research and development',
  },
];

// Example 9: Error handling
export const errorHandlingExample = {
  // Missing prompt
  missingPrompt: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      aspect_ratio: '16:9',
      // Missing required 'prompt' field
    },
    expectedResponse: {
      success: false,
      error: 'Prompt is required',
    },
  },

  // Invalid aspect ratio
  invalidAspectRatio: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      prompt: 'A beautiful landscape',
      aspect_ratio: '25:1', // Invalid - outside 21:9 to 9:21 range
    },
    expectedResponse: {
      success: false,
      error: 'Invalid aspect ratio',
    },
  },

  // Invalid safety tolerance
  invalidSafetyTolerance: {
    url: 'POST /flux/flux-pro-ultra/generate',
    body: {
      prompt: 'A beautiful landscape',
      safety_tolerance: 10, // Invalid - must be 0-6
    },
    expectedResponse: {
      success: false,
      error: 'Safety tolerance must be between 0 and 6',
    },
  },
};

// Example 10: Response format
export const responseFormatExample = {
  success: {
    success: true,
    data: {
      request_id: 'req_123456789',
      status: 'Ready',
      image_url:
        'https://delivery-us1.bfl.ai/results/2c/8383718ff6fca1/8ff6fca14ee54092a05264e168d6d113/sample.jpeg?se=2025-10-07T10%3A20%3A38Z&sp=r&sv=2024-11-04&sr=b&rsct=image/jpeg&sig=05a5IMFwXThvMr43v2aaOZ6RHB1fTBDifSZb74Sv4Vk%3D',
      ready: true,
      attempts: 3,
    },
  },

  pending: {
    success: true,
    data: {
      status: 'Pending',
      ready: false,
    },
  },

  error: {
    success: false,
    error: 'Image generation failed',
    message: 'Content policy violation',
    request_id: 'req_123456789',
  },
};

// Example 11: Complete workflow with error handling
export const completeWorkflowExample = `
// 1. Create a FLUX Pro Ultra image generation request
const response = await fetch('https://api.sloot.ai/flux/flux-pro-ultra/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'A cyberpunk cityscape at night with neon lights and flying cars',
    aspect_ratio: '21:9',
    output_format: 'png',
    raw: false,
    safety_tolerance: 2,
    prompt_upsampling: true
  })
});

const result = await response.json();

if (result.success) {
  console.log('Image generated successfully!');
  console.log('Image URL:', result.data.image_url);
  console.log('Request ID:', result.data.request_id);
} else {
  console.error('Error:', result.error);
  console.error('Message:', result.message);
}
`;
