// see toggl API docs, created some typings based on it

declare module TogglApi {
    
    interface Currency {
        currency: string;
        amount: number;
    }
    
    // http://7eggs.github.io/node-toggl-api/TogglClient.html#detailedReport
    interface TimeEntry {
        id: number; //time entry id
        pid: number; //project id
        tid: null; //task id
        uid: number; //user id whose time entry it is
        description: string; //time entry description
        start: string; //start time of the time entry in ISO 8601 date and time format (YYYY-MM-DDTHH:MM:SS)
        end: string; //end time of the time entry in ISO 8601 date and time format (YYYY-MM-DDTHH:MM:SS)
        updated: string; //last time the time entry was updated in ISO 8601 date and time format (YYYY-MM-DDTHH:MM:SS)
        dur: number; //time entry duration in milliseconds
        user: string; //full name of the user whose time entry it is
        use_stop: boolean; //if the stop time is saved on the time entry, depends on user's personal settings.
        client: string; //client name for which the time entry was recorded
        project: string; //project name for which the time entry was recorded
        task: string; //task name for which the time entry was recorded
        billable: number; //billed amount
        is_billable: boolean; // boolean, if the time entry was billable or not
        cur: string; //billable amount currency
        tags: string[]; //array of tag names, which assigned for the time entry
    }

    interface Report {
        total_grand: number; //total time in milliseconds for the selected report
        total_billable: number; //total billable time in milliseconds for the selected report
        total_currencies: Currency[]; //an array with amounts and currencies for the selected report
        total_count: number; //total number of time entries that were found for the request. Pay attention to the fact that the amount of time entries returned is max the number which is returned with the per_page field (currently 50). To get the next batch of time entries you need to do a new request with same parameters and the incremented page parameter. It is not possible to get all the time entries with one request.
        per_page: number; //how many time entries are displayed in one request
        data: TimeEntry[]; //an array with detailed information of the requested report. The structure of the data in the array depends on the report.
    }

//https://github.com/toggl/toggl_api_docs/blob/master/reports.md#request-parameters
    interface RequestParameters {
        user_agent?: string; //The name of your application or your email address so we can get in touch in case you're doing something wrong.
        workspace_id: number; //The workspace whose data you want to access.
        since?: string; //ISO 8601 date (YYYY-MM-DD) format. Defaults to today - 6 days.
        until?: string; // ISO 8601 date (YYYY-MM-DD) format. Note: Maximum date span (until - since) is one year. Defaults to today, unless since is in future or more than year ago, in this case until is since + 6 days.
        billable?: string; //"yes", "no", or "both". Defaults to "both".
        client_ids?: string; //A list of client IDs separated by a comma. Use "0" if you want to filter out time entries without a client.
        project_ids?: string; //A list of project IDs separated by a comma. Use "0" if you want to filter out time entries without a project.
        user_ids?: string; //A list of user IDs separated by a comma.
        members_of_group_ids?: string; //A list of group IDs separated by a comma. This limits provided user_ids to the members of the given groups.
        or_members_of_group_ids?: string; //A list of group IDs separated by a comma. This extends provided user_ids with the members of the given groups.
        tag_ids?: string; //A list of tag IDs separated by a comma. Use "0" if you want to filter out time entries without a tag.
        task_ids?: string; //A list of task IDs separated by a comma. Use "0" if you want to filter out time entries without a task.
        time_entry_ids?: string; //A list of time entry IDs separated by a comma.
        description?: string; //Matches against time entry descriptions.
        without_description?: string; //"true" or "false". Filters out the time entries which do not have a description (literally "(no description)").
        // For detailed reports: "date", "description", "duration", or "user"
        // For summary reports: "title", "duration", or "amount"
        // For weekly reports: "title", "day1", "day2", "day3", "day4", "day5", "day6", "day7", or "week_total"
        order_field?: string;
        order_desc?: string; // "on" for descending, or "off" for ascending order.
        distinct_rates?: string; //"on" or "off". Defaults to "off".
        rounding?: string; //"on" or "off". Defaults to "off". Rounds time according to workspace settings.
        display_hours?: string; //"decimal" or "minutes". Defaults to "minutes". Determines whether to display hours as a decimal number or with minutes.
    }

    interface DetailedRequestParameters extends RequestParameters {
        page?: number; //integer, default 1
    }

    interface Error {
        message: string,
        tip: string;
        // 402 Payment Required - feature is not included in current subscription level of workspace
        // 410 Gone -  this api version is deprecated. Update your client.
        // 429 Too Many Requests - add delay between requests.
        code: number;
    }

    interface Client {
        detailedReport: (requestParams: DetailedRequestParameters,
                         callbac: (err: Error, report: Report) => void) => void;
        
        destroy: () => void;        
    }

}