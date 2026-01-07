import { calculatePricing, saveFileFromUrl, saveSlootToolUsage, ToolData } from "./runToolUtils";
import { getClient } from "./supabaseClient";

export const aimlGenerateVideoEndpoint = async (pollingFile: any, toolData: ToolData) => {
    let status = 'pending';
    const files: any[] = [];
    let cost = 0;
    let pollingFileResponse: any = null;
    const endpoint = toolData.sloot?.config?.polling_url + pollingFile.task_id;

    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${toolData.user_connect_api?.auth_token}`,
        },
    });
    if (!response.ok) {
        console.error('Error in aimlGenerateVideoEndpoint:', response.statusText);
        status = 'error';
        pollingFileResponse = {
            code: response.status,
            msg: response.statusText,
        };
    } else {
        pollingFileResponse = await response.json();
        console.log('pollingFileResponse', pollingFileResponse);

        console.log('pollingFileResponse.status', pollingFileResponse.status);
        if (pollingFileResponse.status === 'completed') {
            status = 'completed';
            const file = await saveFileFromUrl(pollingFileResponse.video.url, pollingFile.user_id, toolData);
            if (file) {
                files.push(file);
            }

            cost = calculatePricing(toolData, pollingFileResponse.data);
            await saveSlootToolUsage(pollingFile.user_id, pollingFileResponse, toolData, cost);
        } else {
            status = 'pending';
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
