/**
 * Get pricing for different AI model brands with markup applied
 * @param usage - The usage object from API response
 * @param brand - The AI brand (deepseek, openai, anthropic, gemini, generic)
 * @param model - The specific model to use
 * @param markup - Markup percentage as decimal (default: 0.20 for 20%)
 * @returns Cost breakdown and total with markup applied
 */

// Type definitions
interface UsageData {
  [key: string]: any;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_cache_hit_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
}

interface ModelPricing {
  input?: number;
  output?: number;
  input_cache_hit?: number;
  input_cache_miss?: number;
}

interface BrandPricing {
  [modelName: string]: ModelPricing;
}

interface PricingData {
  deepseek: BrandPricing;
  openai: BrandPricing;
  anthropic: BrandPricing;
  gemini: BrandPricing;
  generic: BrandPricing;
}

interface UsageMapping {
  inputTokens: string;
  outputTokens: string;
  cachedTokens: string | null;
  totalTokens: string;
}

interface UsageMappings {
  deepseek: UsageMapping;
  openai: UsageMapping;
  anthropic: UsageMapping;
  gemini: UsageMapping;
  generic: UsageMapping;
}

interface CostBreakdown {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

interface PricingInfo {
  brand: string;
  model: string;
  input_per_1k?: number | undefined;
  output_per_1k?: number | undefined;
  input_cache_hit_per_1k?: number | undefined;
  input_cache_miss_per_1k?: number | undefined;
}

interface CostInfo {
  input_cost: number;
  output_cost: number;
  total_cost: number;
  cache_savings?: number;
}

interface PricingResponse {
  type: 'model';
  brand: string;
  model: string;
  original: UsageData;
  breakdown: CostBreakdown;
  pricing: PricingInfo;
  costs: CostInfo;
}

const getModelPricing = (usage: UsageData, userModel: any): PricingResponse => {
  // If user has their own API key, return zero costs
  if (
    userModel.apikey &&
    (typeof userModel.apikey === 'string' || userModel.apikey.key)
  ) {
    const brand = userModel.model_id.brand_id.slug;
    const model = userModel.model_id.model;

    return {
      type: 'model',
      brand: brand,
      model: model,
      original: usage,
      breakdown: {
        input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
        output_tokens: usage.output_tokens || usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
      pricing: {
        brand: brand,
        model: model,
        input_per_1k: 0,
        output_per_1k: 0,
      },
      costs: {
        input_cost: 0,
        output_cost: 0,
        total_cost: 0,
      },
    };
  }

  // Brand-specific usage field mappings
  const usageMappings: UsageMappings = {
    deepseek: {
      inputTokens: 'prompt_cache_miss_tokens',
      outputTokens: 'completion_tokens',
      cachedTokens: 'prompt_cache_hit_tokens',
      totalTokens: 'total_tokens',
    },
    openai: {
      inputTokens: 'input_tokens',
      outputTokens: 'output_tokens',
      cachedTokens: 'input_tokens_details?.cached_tokens',
      totalTokens: 'total_tokens',
    },
    anthropic: {
      inputTokens: 'input_tokens',
      outputTokens: 'output_tokens',
      cachedTokens: 'cache_read_input_tokens',
      totalTokens: 'total_tokens',
    },
    gemini: {
      inputTokens: 'prompt_tokens',
      outputTokens: 'completion_tokens',
      cachedTokens: null, // Gemini doesn't have cache
      totalTokens: 'total_tokens',
    },
    generic: {
      inputTokens: 'prompt_tokens',
      outputTokens: 'completion_tokens',
      cachedTokens: null, // Generic doesn't have cache
      totalTokens: 'total_tokens',
    },
  };

  const brand = userModel.model_id.brand_id.slug;
  const model = userModel.model_id.model;

  return calculateCost(usage, brand, model, usageMappings, userModel);
};

/**
 * Calculate cost for any brand/model combination
 * @param usage - The usage object from API response
 * @param brand - The AI brand
 * @param model - The specific model
 * @param markup - Markup percentage as decimal
 * @param pricing - Pricing object for all brands/models
 * @param usageMappings - Field mappings for each brand
 * @returns Cost breakdown and total with markup applied
 */
const calculateCost = (
  usage: UsageData,
  brand: string,
  model: string,
  usageMappings: UsageMappings,
  userModel: any
): PricingResponse => {
  // Use pre-marked up pricing from userModel
  const markedUpPricing: ModelPricing = {
    input: userModel.model_id.input_per_1k || 0,
    output: userModel.model_id.output_per_1k || 0,
    input_cache_hit: userModel.model_id.input_cache_per_1k || 0,
    input_cache_miss: userModel.model_id.input_per_1k || 0, // Use input pricing for cache miss
  };

  // Get usage mapping for the brand
  const mapping =
    usageMappings[brand as keyof UsageMappings] || usageMappings.generic;

  // Extract token counts using the brand-specific mappings
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let totalTokens = 0;

  // Handle nested properties (like input_tokens_details.cached_tokens)
  if (mapping.inputTokens.includes('?')) {
    const [parent, child] = mapping.inputTokens.split('?.');
    if (parent && child) {
      inputTokens = usage[parent]?.[child] || 0;
    } else {
      inputTokens = 0;
    }
  } else {
    inputTokens = usage[mapping.inputTokens] || 0;
  }

  outputTokens = usage[mapping.outputTokens] || 0;
  totalTokens = usage[mapping.totalTokens] || 0;

  // Handle cached tokens if the brand supports them
  if (mapping.cachedTokens) {
    if (mapping.cachedTokens.includes('?')) {
      const [parent, child] = mapping.cachedTokens.split('?.');
      if (parent && child) {
        cachedTokens = usage[parent]?.[child] || 0;
      } else {
        cachedTokens = 0;
      }
    } else {
      cachedTokens = usage[mapping.cachedTokens] || 0;
    }
  }

  // Calculate costs using per 1K pricing
  let inputCost: number, outputCost: number;

  if (brand === 'deepseek') {
    // DeepSeek: separate pricing for cache hits vs misses
    const cacheHitCost =
      (cachedTokens / 1000) * (markedUpPricing.input_cache_hit || 0);
    const cacheMissCost =
      (inputTokens / 1000) * (markedUpPricing.input_cache_miss || 0);
    inputCost = Math.max(0.0001, cacheHitCost + cacheMissCost);
    outputCost = Math.max(
      0.0001,
      (outputTokens / 1000) * (markedUpPricing.output || 0)
    );
  } else {
    // Standard pricing for other brands
    inputCost = Math.max(
      0.0001,
      (inputTokens / 1000) * (markedUpPricing.input || 0)
    );
    outputCost = Math.max(
      0.0001,
      (outputTokens / 1000) * (markedUpPricing.output || 0)
    );
  }

  const totalCost = inputCost + outputCost;

  // Calculate cache savings if applicable
  let cacheSavings = 0;
  if (mapping.cachedTokens && brand === 'deepseek') {
    // DeepSeek: cache savings is the difference between cache miss and cache hit rates
    const cacheMissRate = markedUpPricing.input_cache_miss || 0;
    const cacheHitRate = markedUpPricing.input_cache_hit || 0;
    cacheSavings = (cachedTokens / 1000) * (cacheMissRate - cacheHitRate);
  } else if (mapping.cachedTokens) {
    // Other brands: standard cache savings calculation
    cacheSavings = (cachedTokens / 1000) * (markedUpPricing.input || 0);
  }

  // Build response object
  const response: PricingResponse = {
    type: 'model',
    brand: brand,
    model: model,
    original: usage,
    breakdown: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
    },
    pricing: {
      brand: brand,
      model: model,
      ...(brand === 'deepseek'
        ? {
            input_cache_hit_per_1k:
              Math.round((markedUpPricing.input_cache_hit || 0) * 10000) /
              10000,
            input_cache_miss_per_1k:
              Math.round((markedUpPricing.input_cache_miss || 0) * 10000) /
              10000,
            output_per_1k:
              Math.round((markedUpPricing.output || 0) * 10000) / 10000,
          }
        : {
            input_per_1k:
              Math.round((markedUpPricing.input || 0) * 10000) / 10000,
            output_per_1k:
              Math.round((markedUpPricing.output || 0) * 10000) / 10000,
          }),
    },
    costs: {
      input_cost: Math.max(0.0001, Math.round(inputCost * 10000) / 10000),
      output_cost: Math.max(0.0001, Math.round(outputCost * 10000) / 10000),
      total_cost: Math.max(0.0002, Math.round(totalCost * 10000) / 10000),
    },
  };

  // Add cache-related fields only if the brand supports caching
  if (mapping.cachedTokens) {
    response.breakdown.cached_tokens = cachedTokens;
    response.costs.cache_savings = Math.round(cacheSavings * 10000) / 10000;
  }

  return response;
};

export { getModelPricing };
