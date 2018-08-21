import {Vector} from "prelude.ts";
import logger from "./logger";
import Bottleneck from "bottleneck"

export module TogglConnector {

    // throttle for 1 second (respect toggl api limits)
    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 1050
    });
    
    //https://github.com/7eggs/node-toggl-api
    const TogglClient = require('toggl-api');
    
    export interface TogglQueryParams {
        apiToken: string;
        from: string; //YYYY-MM-DD format
        to: string; //YYYY-MM-DD format
        workspaceId: number;
        userId: number;
    }
    
    async function executeQuery(togglClient: TogglApi.Client, queryParams: TogglQueryParams, page: number): Promise<TogglApi.Report> {
        return limiter.schedule(() => {
            const requestParams: TogglApi.DetailedRequestParameters = {
                workspace_id: queryParams.workspaceId,
                since: queryParams.from,
                until: queryParams.to,
                // user_ids: String(queryParams.userId),
                //order_field: 'date', //currently sorting doesn't work
                //order_desc: 'off',
                page: page
            };
            
            return new Promise<TogglApi.Report>((resolve, reject) => {
                togglClient.detailedReport(requestParams, (err: TogglApi.Error, report: TogglApi.Report) => {
                    if (err !== null) {
                        const errorMsg = `Failed to retrieve Toggl data, code: "${err.code}", message: "${err.message}", tip: "${err.tip}"`;
                        logger.error(errorMsg);
                        return reject(new Error(errorMsg));
                    }
                    // logger.info("Acquired page: " + page + ", total_count: " + report.total_count + ", per_page: " + report.per_page);
                    return resolve(report);
                });
            });
        });
    }

    async function queryPageEntries(togglClient: TogglApi.Client, queryParams: TogglQueryParams, page: number): Promise<Vector<TogglApi.TimeEntry>> {
        const report: TogglApi.Report = await executeQuery(togglClient, queryParams, page);
        let reportData: Vector<TogglApi.TimeEntry> = Vector.ofIterable(report.data);
        if (page * report.per_page < report.total_count) {
            const nextPageEntries = await queryPageEntries(togglClient, queryParams, page + 1);
            reportData = reportData.appendAll(nextPageEntries);
        }
        return reportData;
    }

    //recursively query all pages and fill togglReportData with time entries
    //https://github.com/toggl/toggl_api_docs/blob/master/reports/detailed.md
    //https://github.com/toggl/toggl_api_docs/blob/master/reports.md#request-parameters
    export async function getTogglEntries(queryParams: TogglQueryParams): Promise<Vector<TogglApi.TimeEntry>>{
        const togglClient = <TogglApi.Client>new TogglClient({
            apiToken: queryParams.apiToken
        });
        const data = await queryPageEntries(togglClient, queryParams, 1);
        togglClient.destroy();
            
        return data;
    }
}