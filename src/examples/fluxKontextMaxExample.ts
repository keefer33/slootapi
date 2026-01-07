// FLUX Kontext Max API Examples
// Based on: https://docs.bfl.ai/api-reference/tasks/edit-or-create-an-image-with-flux-kontext-max

// Example 1: Basic image generation with single input
export const basicGenerationExample = {
  url: 'POST /flux/flux-kontext-max/generate',
  body: {
    prompt: 'ein fantastisches bild',
    input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    aspect_ratio: '16:9',
    output_format: 'png',
  },
  note: 'Basic image generation with single input image',
};

// Example 2: Multiple input images (Experimental Multiref)
export const multiImageExample = {
  url: 'POST /flux/flux-kontext-max/generate',
  body: {
    prompt: 'Combine these images into a cohesive artwork',
    input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    input_image_2:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXAAAALwCAIAAACx+sqvAAEAAElEQVR4nEz925JkWXIlBq6lqvuYu0...',
    input_image_3: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    aspect_ratio: '16:9',
    output_format: 'png',
  },
  note: 'Multiple input images using experimental multiref feature',
};

// Example 3: Image URLs (auto-converted to base64)
export const imageUrlExample = {
  url: 'POST /flux/flux-kontext-max/generate',
  body: {
    prompt: 'Transform these images into a watercolor painting',
    input_image: 'https://example.com/image1.jpg',
    input_image_2: 'https://example.com/image2.png',
    input_image_3: 'https://example.com/image3.jpeg',
    aspect_ratio: '21:9',
    output_format: 'png',
  },
  note: 'Using image URLs (automatically converted to base64)',
};

// Example 4: Mixed base64 and URL inputs
export const mixedInputExample = {
  url: 'POST /flux/flux-kontext-max/generate',
  body: {
    prompt: 'Create a collage from these images',
    input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    input_image_2: 'https://example.com/image2.jpg',
    input_image_3:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXAAAALwCAIAAACx+sqvAAEAAElEQVR4nEz925JkWXIlBq6lqvuYu0...',
    input_image_4: 'https://example.com/image4.png',
    aspect_ratio: '9:16',
    output_format: 'jpeg',
  },
  note: 'Mixed base64 and URL inputs for maximum flexibility',
};

// Example 5: Different aspect ratios
export const aspectRatioExamples = {
  ultraWide: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A panoramic landscape',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '21:9',
    },
    note: 'Ultra-wide aspect ratio (21:9)',
  },
  standard: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A standard landscape',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '16:9',
    },
    note: 'Standard landscape aspect ratio (16:9)',
  },
  square: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A square composition',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '9:9',
    },
    note: 'Square aspect ratio (9:9)',
  },
  portrait: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A portrait composition',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '9:16',
    },
    note: 'Portrait aspect ratio (9:16)',
  },
  ultraTall: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A tall vertical composition',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '9:21',
    },
    note: 'Ultra-tall aspect ratio (9:21)',
  },
};

// Example 6: Advanced parameters
export const advancedExample = {
  url: 'POST /flux/flux-kontext-max/generate',
  body: {
    prompt: 'A highly detailed artistic interpretation',
    input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    input_image_2:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXAAAALwCAIAAACx+sqvAAEAAElEQVR4nEz925JkWXIlBq6lqvuYu0...',
    seed: 42,
    aspect_ratio: '16:9',
    output_format: 'png',
    prompt_upsampling: true,
    safety_tolerance: 3,
  },
  note: 'Advanced parameters with seed, upsampling, and custom safety tolerance',
};

// Example 7: Webhook configuration
export const webhookExample = {
  url: 'POST /flux/flux-kontext-max',
  body: {
    prompt: 'A complex multi-image composition',
    input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    input_image_2:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXAAAALwCAIAAACx+sqvAAEAAElEQVR4nEz925JkWXIlBq6lqvuYu0...',
    aspect_ratio: '16:9',
    webhook_url: 'https://your-app.com/webhook/flux-kontext-max',
    webhook_secret: 'your-webhook-secret',
  },
  note: 'Using webhook for async processing',
};

// Example 8: Safety tolerance levels
export const safetyToleranceExamples = {
  strict: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A family-friendly artistic scene',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      safety_tolerance: 0,
    },
    note: 'Most strict moderation (0)',
  },
  moderate: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A creative artistic interpretation',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      safety_tolerance: 3,
    },
    note: 'Moderate moderation (3)',
  },
  lenient: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'An abstract artistic concept',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      safety_tolerance: 6,
    },
    note: 'Least strict moderation (6)',
  },
};

// Example 9: Async workflow (create request, then poll)
export const asyncWorkflowExample = {
  // Step 1: Create request
  createRequest: {
    url: 'POST /flux/flux-kontext-max',
    body: {
      prompt: 'A detailed multi-image composition',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      input_image_2:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABXAAAALwCAIAAACx+sqvAAEAAElEQVR4nEz925JkWXIlBq6lqvuYu0...',
      aspect_ratio: '16:9',
    },
    response: {
      success: true,
      data: {
        request_id: 'req_123456789',
        polling_url: 'https://api.bfl.ai/v1/result/req_123456789',
      },
    },
  },
  // Step 2: Poll for result
  pollResult: {
    url: 'GET /flux/flux-kontext-max/poll?polling_url=https://api.bfl.ai/v1/result/req_123456789',
    response: {
      success: true,
      data: {
        status: 'Ready',
        image_url: 'https://delivery-us1.bfl.ai/results/...',
        ready: true,
      },
    },
  },
};

// Example 10: Error handling
export const errorExamples = {
  missingPrompt: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    },
    expectedError: {
      success: false,
      error: 'Prompt is required',
    },
  },
  invalidAspectRatio: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A test image',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      aspect_ratio: '2:1', // Invalid aspect ratio
    },
    expectedError: {
      success: false,
      error: 'Invalid aspect ratio',
      message: 'Aspect ratio must be between 21:9 and 9:21',
    },
  },
  invalidSafetyTolerance: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A test image',
      input_image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      safety_tolerance: 10, // Out of range
    },
    expectedError: {
      success: false,
      error: 'Invalid safety tolerance',
      message: 'Safety tolerance must be between 0 and 6',
    },
  },
  failedImageProcessing: {
    url: 'POST /flux/flux-kontext-max/generate',
    body: {
      prompt: 'A test image',
      input_image: 'https://invalid-url.com/nonexistent.jpg',
      input_image_2: 'https://another-invalid-url.com/nonexistent.png',
    },
    expectedError: {
      success: false,
      error: 'Failed to process input images',
      message: 'None of the provided images could be processed',
    },
  },
};

// Example 11: Supported parameters summary
export const parameterSummary = {
  required: {
    prompt: 'string - Text prompt for image generation',
  },
  optional: {
    input_image: 'string | null - Base64 encoded image or URL (primary input)',
    input_image_2:
      'string | null - Base64 encoded image or URL (experimental multiref)',
    input_image_3:
      'string | null - Base64 encoded image or URL (experimental multiref)',
    input_image_4:
      'string | null - Base64 encoded image or URL (experimental multiref)',
    seed: 'number | null - Seed for reproducibility',
    aspect_ratio: 'string | null - Aspect ratio between 21:9 and 9:21',
    output_format: 'jpeg | png | null - Output format, default: png',
    webhook_url: 'string | null - Webhook URL for notifications',
    webhook_secret: 'string | null - Webhook signature secret',
    prompt_upsampling: 'boolean - Enable prompt upsampling, default: false',
    safety_tolerance: 'number - Moderation level (0-6), default: 2',
  },
  polling: {
    max_polls: 'number - Maximum polling attempts, default: 60',
    poll_interval: 'number - Polling interval in ms, default: 2000',
  },
  uniqueFeatures: {
    multipleInputs: 'Supports up to 4 input images for complex compositions',
    experimentalMultiref:
      'input_image_2, input_image_3, input_image_4 are experimental multiref features',
    flexibleAspectRatios: 'Supports aspect ratios from 21:9 to 9:21',
    automaticUrlConversion: 'Image URLs are automatically converted to base64',
  },
};

// Example 12: Valid aspect ratios
export const validAspectRatios = [
  '21:9',
  '20:9',
  '19:9',
  '18:9',
  '17:9',
  '16:9',
  '15:9',
  '14:9',
  '13:9',
  '12:9',
  '11:9',
  '10:9',
  '9:9',
  '9:10',
  '9:11',
  '9:12',
  '9:13',
  '9:14',
  '9:15',
  '9:16',
  '9:17',
  '9:18',
  '9:19',
  '9:20',
  '9:21',
];
