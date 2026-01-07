/**
 * Debug tool to help identify response structure issues
 */

import { extractFromResponse } from '../utils/simpleResponseExtractor';

// Test with the exact error case
const debugTest = {
  response: {
    // Add your actual response structure here
    // This is just a placeholder - replace with your real response
    "response": {
      "msg": "success",
      "code": 200,
      "data": {
        "taskId": "966277e1147aeb393541bc95f252e4c7",
        "recordId": "966277e1147aeb393541bc95f252e4c7"
      }
    }
  },
  config: {
    "pathToParam": "response.data.taskId",
    "pathToStatus": "data.state",
    "statusComplete": "success"
  }
};

console.log('=== Debug Response Structure ===\n');

// Test the extraction
const result = extractFromResponse(debugTest.response, debugTest.config);

console.log('\n=== Result ===');
console.log('Success:', result.success);
if (result.success) {
  console.log('ID:', result.id);
  console.log('Status:', result.status);
} else {
  console.log('Error:', result.error);
}

// Manual path testing
console.log('\n=== Manual Path Testing ===');
console.log('response:', debugTest.response.response);
console.log('response.data:', debugTest.response.response?.data);
console.log('response.data.taskId:', debugTest.response.response?.data?.taskId);

// Test alternative paths
console.log('\n=== Alternative Path Testing ===');
const altPaths = [
  'response.data.taskId',
  'data.taskId', 
  'taskId',
  'response.taskId'
];

altPaths.forEach(path => {
  const value = getNestedProperty(debugTest.response, path);
  console.log(`Path "${path}":`, value);
});

// Helper function for manual testing
function getNestedProperty(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}
