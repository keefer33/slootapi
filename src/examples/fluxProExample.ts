// FLUX 1.1 Pro API Examples
// Based on: https://docs.bfl.ai/api-reference/tasks/generate-an-image-with-flux-11-[pro]

// Example 1: Basic image generation
export const basicGenerationExample = {
  url: 'POST /flux/flux-pro/generate',
  body: {
    prompt: 'ein fantastisches bild',
    width: 1024,
    height: 768,
    output_format: 'jpeg',
  },
  note: 'Basic image generation with default settings',
};

// Example 2: Advanced generation with custom parameters
export const advancedGenerationExample = {
  url: 'POST /flux/flux-pro/generate',
  body: {
    prompt: 'A majestic dragon flying over a medieval castle at sunset',
    width: 1024,
    height: 1024,
    prompt_upsampling: true,
    seed: 42,
    safety_tolerance: 3,
    output_format: 'png',
  },
  note: 'Advanced generation with custom dimensions, upsampling, and seed',
};

// Example 3: Image remixing with base64
export const imageRemixingExample = {
  url: 'POST /flux/flux-pro/generate',
  body: {
    prompt: 'Transform this image into a watercolor painting',
    image_prompt: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    width: 1024,
    height: 768,
    output_format: 'jpeg',
  },
  note: 'Image remixing using base64 encoded image',
};

// Example 4: Image remixing with URL (auto-converted to base64)
export const imageRemixingUrlExample = {
  url: 'POST /flux/flux-pro/generate',
  body: {
    prompt: 'Transform this image into a watercolor painting',
    image_prompt: 'https://example.com/photo.jpg',
    width: 1024,
    height: 768,
    output_format: 'jpeg',
  },
  note: 'Image remixing using URL (automatically converted to base64)',
};

// Example 5: Webhook configuration
export const webhookExample = {
  url: 'POST /flux/flux-pro',
  body: {
    prompt: 'A futuristic cityscape at night',
    width: 1024,
    height: 768,
    webhook_url: 'https://your-app.com/webhook/flux-pro',
    webhook_secret: 'your-webhook-secret',
  },
  note: 'Using webhook for async processing',
};

// Example 6: Different aspect ratios
export const aspectRatioExamples = {
  square: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A beautiful landscape',
      width: 1024,
      height: 1024,
    },
    note: 'Square aspect ratio (1:1)',
  },
  landscape: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A panoramic mountain view',
      width: 1280,
      height: 768,
    },
    note: 'Landscape aspect ratio (16:10)',
  },
  portrait: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A tall building in the city',
      width: 768,
      height: 1024,
    },
    note: 'Portrait aspect ratio (3:4)',
  },
  wide: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A wide ocean view',
      width: 1440,
      height: 768,
    },
    note: 'Wide aspect ratio (16:9)',
  },
};

// Example 7: Safety tolerance levels
export const safetyToleranceExamples = {
  strict: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A family-friendly scene',
      safety_tolerance: 0,
    },
    note: 'Most strict moderation (0)',
  },
  moderate: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A creative artistic scene',
      safety_tolerance: 3,
    },
    note: 'Moderate moderation (3)',
  },
  lenient: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'An abstract artistic concept',
      safety_tolerance: 6,
    },
    note: 'Least strict moderation (6)',
  },
};

// Example 8: Async workflow (create request, then poll)
export const asyncWorkflowExample = {
  // Step 1: Create request
  createRequest: {
    url: 'POST /flux/flux-pro',
    body: {
      prompt: 'A detailed fantasy landscape',
      width: 1024,
      height: 768,
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
    url: 'GET /flux/flux-pro/poll?polling_url=https://api.bfl.ai/v1/result/req_123456789',
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

// Example 9: Error handling
export const errorExamples = {
  missingPrompt: {
    url: 'POST /flux/flux-pro/generate',
    body: {},
    expectedError: {
      success: false,
      error: 'Prompt is required',
    },
  },
  invalidDimensions: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A test image',
      width: 100, // Too small
      height: 100, // Too small
    },
    expectedError: {
      success: false,
      error: 'Invalid width',
      message: 'Width must be between 256 and 1440 pixels and a multiple of 32',
    },
  },
  invalidSafetyTolerance: {
    url: 'POST /flux/flux-pro/generate',
    body: {
      prompt: 'A test image',
      safety_tolerance: 10, // Out of range
    },
    expectedError: {
      success: false,
      error: 'Invalid safety tolerance',
      message: 'Safety tolerance must be between 0 and 6',
    },
  },
};

// Example 10: Supported parameters summary
export const parameterSummary = {
  required: {
    prompt: 'string | null - Text prompt for image generation',
  },
  optional: {
    image_prompt: 'string | null - Base64 encoded image or URL for remixing',
    width: 'number - Width in pixels (256-1440, multiple of 32), default: 1024',
    height:
      'number - Height in pixels (256-1440, multiple of 32), default: 768',
    prompt_upsampling: 'boolean - Enable prompt upsampling, default: false',
    seed: 'number | null - Seed for reproducibility',
    safety_tolerance: 'number - Moderation level (0-6), default: 2',
    output_format: 'jpeg | png | null - Output format, default: jpeg',
    webhook_url: 'string | null - Webhook URL for notifications',
    webhook_secret: 'string | null - Webhook signature secret',
  },
  polling: {
    max_polls: 'number - Maximum polling attempts, default: 60',
    poll_interval: 'number - Polling interval in ms, default: 2000',
  },
};
