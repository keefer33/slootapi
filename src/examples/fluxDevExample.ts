// FLUX.1 Dev API Examples
// Based on: https://docs.bfl.ai/api-reference/tasks/generate-an-image-with-flux1-[dev]

// Example 1: Basic image generation
export const basicGenerationExample = {
  url: 'POST /flux/flux-dev/generate',
  body: {
    prompt: 'ein fantastisches bild',
    width: 1024,
    height: 768,
    steps: 28,
    guidance: 3,
    output_format: 'jpeg',
  },
  note: 'Basic image generation with default settings',
};

// Example 2: High quality generation with more steps
export const highQualityExample = {
  url: 'POST /flux/flux-dev/generate',
  body: {
    prompt: 'A highly detailed fantasy landscape with dragons and castles',
    width: 1024,
    height: 1024,
    steps: 50, // Maximum steps for highest quality
    guidance: 4.5, // High guidance for better prompt adherence
    prompt_upsampling: true,
    output_format: 'png',
  },
  note: 'High quality generation with maximum steps and high guidance',
};

// Example 3: Fast generation with fewer steps
export const fastGenerationExample = {
  url: 'POST /flux/flux-dev/generate',
  body: {
    prompt: 'A simple abstract painting',
    width: 512,
    height: 512,
    steps: 10, // Fewer steps for faster generation
    guidance: 2.0, // Lower guidance for more creative freedom
    output_format: 'jpeg',
  },
  note: 'Fast generation with fewer steps and lower guidance',
};

// Example 4: Image remixing with custom parameters
export const imageRemixingExample = {
  url: 'POST /flux/flux-dev/generate',
  body: {
    prompt: 'Transform this image into a watercolor painting with soft edges',
    image_prompt: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    width: 1024,
    height: 768,
    steps: 35,
    guidance: 3.5,
    output_format: 'jpeg',
  },
  note: 'Image remixing with custom steps and guidance',
};

// Example 5: Image remixing with URL (auto-converted to base64)
export const imageRemixingUrlExample = {
  url: 'POST /flux/flux-dev/generate',
  body: {
    prompt: 'Transform this image into a cyberpunk style',
    image_prompt: 'https://example.com/photo.jpg',
    width: 1024,
    height: 768,
    steps: 30,
    guidance: 4.0,
    output_format: 'png',
  },
  note: 'Image remixing using URL (automatically converted to base64)',
};

// Example 6: Webhook configuration
export const webhookExample = {
  url: 'POST /flux/flux-dev',
  body: {
    prompt: 'A detailed architectural visualization',
    width: 1024,
    height: 768,
    steps: 40,
    guidance: 3.5,
    webhook_url: 'https://your-app.com/webhook/flux-dev',
    webhook_secret: 'your-webhook-secret',
  },
  note: 'Using webhook for async processing with custom parameters',
};

// Example 7: Different step configurations
export const stepConfigurationExamples = {
  ultraFast: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A quick sketch',
      steps: 1, // Minimum steps
      guidance: 1.5, // Minimum guidance
    },
    note: 'Ultra fast generation (1 step)',
  },
  balanced: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A balanced quality image',
      steps: 28, // Default steps
      guidance: 3, // Default guidance
    },
    note: 'Balanced quality and speed (28 steps)',
  },
  highQuality: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A high quality detailed image',
      steps: 50, // Maximum steps
      guidance: 5, // Maximum guidance
    },
    note: 'Maximum quality (50 steps)',
  },
};

// Example 8: Different guidance levels
export const guidanceLevelExamples = {
  creative: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'An abstract artistic interpretation',
      guidance: 1.5, // Low guidance for creativity
    },
    note: 'Low guidance (1.5) for creative freedom',
  },
  balanced: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A realistic portrait',
      guidance: 3, // Default guidance
    },
    note: 'Balanced guidance (3) for good prompt adherence',
  },
  precise: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A highly detailed technical drawing',
      guidance: 5, // High guidance for precision
    },
    note: 'High guidance (5) for precise prompt adherence',
  },
};

// Example 9: Different aspect ratios
export const aspectRatioExamples = {
  square: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A beautiful landscape',
      width: 1024,
      height: 1024,
      steps: 30,
      guidance: 3.5,
    },
    note: 'Square aspect ratio (1:1)',
  },
  landscape: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A panoramic mountain view',
      width: 1280,
      height: 768,
      steps: 35,
      guidance: 3.2,
    },
    note: 'Landscape aspect ratio (16:10)',
  },
  portrait: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A tall building in the city',
      width: 768,
      height: 1024,
      steps: 32,
      guidance: 3.8,
    },
    note: 'Portrait aspect ratio (3:4)',
  },
  wide: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A wide ocean view',
      width: 1440,
      height: 768,
      steps: 40,
      guidance: 3.0,
    },
    note: 'Wide aspect ratio (16:9)',
  },
};

// Example 10: Safety tolerance levels
export const safetyToleranceExamples = {
  strict: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A family-friendly scene',
      safety_tolerance: 0,
      steps: 25,
      guidance: 3,
    },
    note: 'Most strict moderation (0)',
  },
  moderate: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A creative artistic scene',
      safety_tolerance: 3,
      steps: 30,
      guidance: 3.5,
    },
    note: 'Moderate moderation (3)',
  },
  lenient: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'An abstract artistic concept',
      safety_tolerance: 6,
      steps: 35,
      guidance: 4,
    },
    note: 'Least strict moderation (6)',
  },
};

// Example 11: Async workflow (create request, then poll)
export const asyncWorkflowExample = {
  // Step 1: Create request
  createRequest: {
    url: 'POST /flux/flux-dev',
    body: {
      prompt: 'A detailed fantasy landscape',
      width: 1024,
      height: 768,
      steps: 40,
      guidance: 3.5,
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
    url: 'GET /flux/flux-dev/poll?polling_url=https://api.bfl.ai/v1/result/req_123456789',
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

// Example 12: Error handling
export const errorExamples = {
  missingPrompt: {
    url: 'POST /flux/flux-dev/generate',
    body: {},
    expectedError: {
      success: false,
      error: 'Prompt is required',
    },
  },
  invalidSteps: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A test image',
      steps: 60, // Too many steps
    },
    expectedError: {
      success: false,
      error: 'Invalid steps',
      message: 'Steps must be between 1 and 50',
    },
  },
  invalidGuidance: {
    url: 'POST /flux/flux-dev/generate',
    body: {
      prompt: 'A test image',
      guidance: 6, // Too high
    },
    expectedError: {
      success: false,
      error: 'Invalid guidance',
      message: 'Guidance must be between 1.5 and 5',
    },
  },
  invalidDimensions: {
    url: 'POST /flux/flux-dev/generate',
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
};

// Example 13: Supported parameters summary
export const parameterSummary = {
  required: {
    prompt: 'string - Text prompt for image generation',
  },
  optional: {
    image_prompt: 'string | null - Base64 encoded image or URL for remixing',
    width: 'number - Width in pixels (256-1440, multiple of 32), default: 1024',
    height:
      'number - Height in pixels (256-1440, multiple of 32), default: 768',
    steps: 'number | null - Number of generation steps (1-50), default: 28',
    prompt_upsampling: 'boolean - Enable prompt upsampling, default: false',
    seed: 'number | null - Seed for reproducibility',
    guidance: 'number | null - Guidance scale (1.5-5), default: 3',
    safety_tolerance: 'number - Moderation level (0-6), default: 2',
    output_format: 'jpeg | png | null - Output format, default: jpeg',
    webhook_url: 'string | null - Webhook URL for notifications',
    webhook_secret: 'string | null - Webhook signature secret',
  },
  polling: {
    max_polls: 'number - Maximum polling attempts, default: 60',
    poll_interval: 'number - Polling interval in ms, default: 2000',
  },
  uniqueFeatures: {
    steps: 'FLUX.1 Dev specific: Controls generation quality vs speed (1-50)',
    guidance:
      'FLUX.1 Dev specific: Controls prompt adherence vs creativity (1.5-5)',
  },
};
