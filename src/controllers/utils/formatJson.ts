import { Request, Response } from 'express';

interface FormatJsonRequest {
  jsonString: string;
}

interface FormatJsonResponse {
  success: boolean;
  formattedJson?: string;
  error?: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const formatJson = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const { jsonString }: FormatJsonRequest = req.body;

    if (!jsonString) {
      const errorResponse: FormatJsonResponse = {
        success: false,
        error: 'jsonString is required',
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Create the prompt for OpenAI
    const prompt = `Please fix and format the following JSON. The JSON may have syntax errors like missing quotes around property names, missing quotes around array values, unescaped quotes in strings, or other common JSON formatting issues. Return only the corrected JSON without any explanations or markdown formatting.

Input JSON:
${jsonString}`;

    // Make request to OpenAI
    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a JSON formatting expert. Fix JSON syntax errors and format it properly. Return only the corrected JSON, no explanations.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0,
          max_tokens: 2000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      const errorResponse: FormatJsonResponse = {
        success: false,
        error: `OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`,
      };
      res.status(500).json(errorResponse);
      return;
    }

    const responseData = (await openaiResponse.json()) as OpenAIResponse;
    const formattedJson = responseData.choices[0]?.message?.content?.trim();

    if (!formattedJson) {
      const errorResponse: FormatJsonResponse = {
        success: false,
        error: 'No response from formatting service',
      };
      res.status(500).json(errorResponse);
      return;
    }

    // Validate that the response is valid JSON
    try {
      JSON.parse(formattedJson);
    } catch {
      const errorResponse: FormatJsonResponse = {
        success: false,
        error: 'Formatted response is not valid JSON',
      };
      res.status(500).json(errorResponse);
      return;
    }

    const successResponse: FormatJsonResponse = {
      success: true,
      formattedJson,
    };
    res.status(200).json(successResponse);
  } catch (error: any) {
    const errorResponse: FormatJsonResponse = {
      success: false,
      error: error.message,
    };
    res.status(500).json(errorResponse);
  }
};

export default formatJson;
