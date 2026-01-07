import { saveFileFromUrl, saveSlootToolUsage, calculatePricing, ToolData } from "./runToolUtils";
import { getClient } from "./supabaseClient";

// Default jobs processing function
const defaultJobsProcess = async (pollingFileResponse: any, pollingFile: any, toolData: ToolData) => {
    let status = 'pending';
    const files: any[] = [];
    let cost = 0;

    if (pollingFileResponse.data?.state === 'success') {
        status = 'completed';
        const resultJson = JSON.parse(pollingFileResponse.data.resultJson);

        // Process all resultUrls as an array of files
        if (resultJson.resultUrls && Array.isArray(resultJson.resultUrls)) {
            console.log('Processing multiple files:', resultJson.resultUrls.length);
            for (const fileUrl of resultJson.resultUrls) {
                try {
                    const savedFile = await saveFileFromUrl(fileUrl, pollingFile.user_id, toolData);
                    if (savedFile) {
                        files.push(savedFile);
                    }
                } catch (error) {
                    console.error('Error saving file:', fileUrl, error);
                }
            }
        } else if (resultJson.resultUrls && typeof resultJson.resultUrls === 'string') {
            // Handle single file case
            try {
                const savedFile = await saveFileFromUrl(resultJson.resultUrls, pollingFile.user_id, toolData);
                if (savedFile) {
                    files.push(savedFile);
                }
            } catch (error) {
                console.error('Error saving single file:', resultJson.resultUrls, error);
            }
        }
        cost = calculatePricing(toolData, pollingFileResponse);
        // Save usage with numFiles for pricing calculation
        await saveSlootToolUsage(pollingFile.user_id, pollingFileResponse, toolData);
    } else {
        status = 'pending';
    }

    return { status, files, cost };
};

// Veo record info processing function (placeholder)
const veoRecordInfoProcess = async (pollingFileResponse: any, pollingFile: any, toolData: ToolData) => {
    let status = 'pending';
    const files: any[] = [];
    let cost = 0;

    if (pollingFileResponse.data?.successFlag === 1) {
        status = 'completed';
        const resultJson = pollingFileResponse.data.response

        // Process all resultUrls as an array of files
        if (resultJson.resultUrls && Array.isArray(resultJson.resultUrls)) {
            console.log('Processing multiple files:', resultJson.resultUrls.length);
            for (const fileUrl of resultJson.resultUrls) {
                try {
                    const savedFile = await saveFileFromUrl(fileUrl, pollingFile.user_id, toolData);
                    if (savedFile) {
                        files.push(savedFile);
                    }
                } catch (error) {
                    console.error('Error saving file:', fileUrl, error);
                }
            }
        } else if (resultJson.resultUrls && typeof resultJson.resultUrls === 'string') {
            // Handle single file case
            try {
                const savedFile = await saveFileFromUrl(resultJson.resultUrls, pollingFile.user_id, toolData);
                if (savedFile) {
                    files.push(savedFile);
                }
            } catch (error) {
                console.error('Error saving single file:', resultJson.resultUrls, error);
            }
        }
        cost = calculatePricing(toolData, pollingFileResponse);
        // Save usage with numFiles for pricing calculation
        await saveSlootToolUsage(pollingFile.user_id, pollingFileResponse, toolData, cost);
    } else {
        status = 'pending';
    }

    return { status, files, cost };
};

export const kieaiEndpoint = async (pollingFile: any, toolData: ToolData) => {
    let status = 'pending';
    const files: any[] = [];
    let cost = 0;
    let pollingFileResponse: any = null;

    const endpoint = `https://api.kie.ai/api/v1/${toolData.sloot?.poll || 'jobs/recordInfo'}?taskId=${pollingFile.task_id}`


    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${toolData.user_connect_api?.auth_token}`,
        },
    });
    if (!response.ok) {
        console.error('Error in kieaiEndpoint:', response.statusText);
        status = 'error';
        pollingFileResponse = {
            code: response.status,
            msg: response.statusText,
        };
    } else {
        pollingFileResponse = await response.json();
        console.log('pollingFileResponse', pollingFileResponse);
        if (pollingFileResponse.code !== 200) {
            status = 'error';
        } else {
            // Process based on poll type
            const pollType = toolData.sloot?.poll;
            let processResult;

            switch (pollType) {
                case 'veo/record-info':
                    processResult = await veoRecordInfoProcess(pollingFileResponse, pollingFile, toolData);
                    break;
                default:
                    processResult = await defaultJobsProcess(pollingFileResponse, pollingFile, toolData);
                    break;
            }

            status = processResult.status;
            files.push(...processResult.files);
            cost = processResult.cost;
        }
    }

    const duration = Math.floor((Date.now() - new Date(pollingFile.created_at).getTime()) / 1000);
    const { supabase } = await getClient();
    await supabase
    .from('user_polling_files')
    .update({
      status: status,
      files: files,
      config: {
        ...pollingFile.config,
        callback_data: pollingFileResponse,
      },
      duration: duration,
      cost: cost,
    })
    .eq('id', pollingFile.id)
}

/*
Success Callback Example
{
    "code": 200,
    "data": {
        "completeTime": 1755599644000,
        "consumeCredits": 100,
        "costTime": 8,
        "createTime": 1755599634000,
        "model": "bytedance/seedream-v4-text-to-image",
        "param": "{\"callBackUrl\":\"https://your-domain.com/api/callback\",\"model\":\"bytedance/seedream-v4-text-to-image\",\"input\":{\"prompt\":\"Draw the following system of binary linear equations and the corresponding solution steps on the blackboard: 5x + 2y = 26; 2x -y = 5.\",\"image_size\":\"square_hd\",\"image_resolution\":\"1K\",\"max_images\":1,\"seed\":null}}",
        "remainedCredits": 2510330,
        "resultJson": "{\"resultUrls\":[\"https://example.com/generated-image.jpg\"]}",
        "state": "success",
        "taskId": "e989621f54392584b05867f87b160672",
        "updateTime": 1755599644000
    },
    "msg": "Playground task completed successfully."
}
Failure Callback Example
{
    "code": 501,
    "data": {
        "completeTime": 1755597081000,
        "consumeCredits": 0,
        "costTime": 0,
        "createTime": 1755596341000,
        "failCode": "500",
        "failMsg": "Internal server error",
        "model": "bytedance/seedream-v4-text-to-image",
        "param": "{\"callBackUrl\":\"https://your-domain.com/api/callback\",\"model\":\"bytedance/seedream-v4-text-to-image\",\"input\":{\"prompt\":\"Draw the following system of binary linear equations and the corresponding solution steps on the blackboard: 5x + 2y = 26; 2x -y = 5.\",\"image_size\":\"square_hd\",\"image_resolution\":\"1K\",\"max_images\":1,\"seed\":null}}",
        "remainedCredits": 2510430,
        "state": "fail",
        "taskId": "bd3a37c523149e4adf45a3ddb5faf1a8",
        "updateTime": 1755597097000
    },
    "msg": "Playground task failed."
}
*/
export const kieaiWebhook = async (req: any) => {
    const taskId = req.body?.data?.taskId || null;
    const { supabase } = await getClient();
    const { data, error } = await supabase
      .from('user_polling_files')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (!error && data) {
        let status = 'pending';
        let file = null;

      if (data.state === 'failed') {
        status = 'error';
      } else {
        status = 'completed';
        const resultJson = JSON.parse(req.body?.data?.resultJson);
        const fileUrl = resultJson.resultUrls[0];
        file = await saveFileFromUrl(fileUrl, data.user_id, data.config?.toolData);
      }
      await supabase
        .from('user_polling_files')
        .update({
          status: status,
          file: file,
          config: {
            ...data.config,
            callback_data: req.body,
          },
        })
        .eq('id', data.id)
    }
};
