/**
 * Simple test for the response extraction using your config examples
 */

import { extractFromResponse, extractFileUrl } from '../utils/simpleResponseExtractor';

// Your first example config and response
const example1 = {
  response: {
    "id": "e7c9abca-f20b-46db-b48c-2ead93494f2e:google/veo3",
    "meta": {
      "usage": {
        "tokens_used": 6720000
      }
    },
    "status": "completed",
    "video": {
      "url": "https://example.com/video1.mp4"
    }
  },
  toolData: {
    config: {
      "method": "GET",
      "params": {
        "generation_id": "string"
      },
      "polling_url": "https://api.aimlapi.com/v2/generate/video/google/generation?generation_id=",
      "pathToParam": "response.id",
      "pathToStatus": "status",
      "statusComplete": "completed",
      "fileUrl": "video.url"
    }
  }
};

// Your second example config and response
const example2 = {
  response: {
    "msg": "success",
    "code": 200,
    "data": {
      "taskId": "966277e1147aeb393541bc95f252e4c7",
      "recordId": "966277e1147aeb393541bc95f252e4c7",
      "state": "success",
      "resultJson": '{"resultUrls": ["https://example.com/file1.jpg", "https://example.com/file2.jpg"]}'
    }
  },
  toolData: {
    config: {
      "method": "GET",
      "params": {
        "taskId": "string"
      },
      "polling_url": "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=",
      "pathToParam": "response.data.taskId",
      "pathToStatus": "data.state",
      "statusComplete": "success",
      "parseResults": "data.resultJson",
      "fileUrl": "resultUrls.[0]"
    }
  }
};

console.log('=== Simple Response Extraction Test ===\n');

// Helper function to map status to database status
function mapToDbStatus(currentStatus: string, statusComplete: string): string {
  return currentStatus === statusComplete ? 'completed' : 'pending';
}

// Test Example 1
console.log('--- Example 1 ---');
console.log('Config pathToParam:', example1.toolData.config.pathToParam);
console.log('Config pathToStatus:', example1.toolData.config.pathToStatus);
console.log('Config statusComplete:', example1.toolData.config.statusComplete);

const result1 = extractFromResponse(example1.response, example1.toolData.config);
console.log('Extraction result:', result1);

if (result1.success) {
  console.log('✅ ID extracted:', result1.id);
  console.log('✅ Status extracted:', result1.status);
  console.log('✅ Polling URL would be:', example1.toolData.config.polling_url + result1.id);
  
  // Show status mapping
  const dbStatus = mapToDbStatus(result1.status || '', example1.toolData.config.statusComplete);
  console.log('✅ Database status would be:', dbStatus, '(mapped from', result1.status, '==', example1.toolData.config.statusComplete, ')');
  
  // Test file URL extraction
  const fileUrlResult1 = extractFileUrl(example1.response, example1.toolData.config);
  if (fileUrlResult1.success) {
    console.log('✅ File URL extracted:', fileUrlResult1.fileUrl);
  } else {
    console.log('❌ File URL extraction failed:', fileUrlResult1.error);
  }
} else {
  console.log('❌ Extraction failed:', result1.error);
}

console.log('\n--- Example 2 ---');
console.log('Config pathToParam:', example2.toolData.config.pathToParam);
console.log('Config pathToStatus:', example2.toolData.config.pathToStatus);
console.log('Config statusComplete:', example2.toolData.config.statusComplete);

const result2 = extractFromResponse(example2.response, example2.toolData.config);
console.log('Extraction result:', result2);

if (result2.success) {
  console.log('✅ ID extracted:', result2.id);
  console.log('✅ Status extracted:', result2.status);
  console.log('✅ Polling URL would be:', example2.toolData.config.polling_url + result2.id);
  
  // Show status mapping
  const dbStatus = mapToDbStatus(result2.status || '', example2.toolData.config.statusComplete);
  console.log('✅ Database status would be:', dbStatus, '(mapped from', result2.status, '==', example2.toolData.config.statusComplete, ')');
  
  // Test file URL extraction with JSON parsing
  const fileUrlResult2 = extractFileUrl(example2.response, example2.toolData.config);
  if (fileUrlResult2.success) {
    console.log('✅ File URL extracted (with JSON parsing):', fileUrlResult2.fileUrl);
    console.log('   - Parsed JSON from:', example2.toolData.config.parseResults);
    console.log('   - Extracted from array index:', example2.toolData.config.fileUrl);
  } else {
    console.log('❌ File URL extraction failed:', fileUrlResult2.error);
  }
} else {
  console.log('❌ Extraction failed:', result2.error);
}

console.log('\n=== Test Complete ===');
