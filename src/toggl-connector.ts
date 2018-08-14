import {Vector} from "prelude.ts";
import logger from "./logger";
import {Helper} from "./helper";
import timeout = Helper.timeout;

//https://github.com/7eggs/node-toggl-api
const TogglClient = require('toggl-api');

export module TogglConnector {

    export interface TogglQueryParams {
        apiToken: string;
        from: string; //YYYY-MM-DD format
        to: string; //YYYY-MM-DD format
        workspaceId: number;
        userId: number;
    }
    
    async function executeQuery(togglClient: TogglApi.Client, queryParams: TogglQueryParams, page: number): Promise<TogglApi.Report> {
        return new Promise<TogglApi.Report>((resolve, reject) => {
            // throttle for 1 second (respect toggl api limits)
            // could track last query (if any) time and only timeout accordingly ... but doesn't matter, not worth the complexity  
            timeout(1000)
                .then(() => {
                    const requestParams = <TogglApi.DetailedRequestParameters>{
                        workspace_id: queryParams.workspaceId,
                        since: queryParams.from,
                        until: queryParams.to,
                        user_ids: String(queryParams.userId),
                        //order_field: 'date', //currently sorting doesn't work
                        //order_desc: 'off',
                        page: page
                    };

                    togglClient.detailedReport(requestParams, (err: TogglApi.Error, report: TogglApi.Report) => {
                        if (err !== null) {
                            return reject(new Error(`Failed to retrieve Toggl data, code: "${err.code}", message: "${err.message}", tip: "${err.tip}"`));
                        }
                        logger.info("acquired page: " + page + ", total_count: " + report.total_count + ", per_page: " + report.per_page);
                        logger.debug('report', {report: report});
                        resolve(report);
                    })
                })
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
        logger.info("querying entries from " + queryParams.from + " to " + queryParams.to);
        const data = await queryPageEntries(togglClient, queryParams, 1);
        togglClient.destroy();
        return data;
    }
}