// partial definitions for API wrapper 'node-redmine', https://github.com/zanran/node-redmine/
// calls official Redmine REST api: http://www.redmine.org/projects/redmine/wiki/Rest_api
declare module RedmineApi {
    
    interface Client {
        issues: (params: QueryParamsIssues, 
                 callback: (err: any, data: RedmineApi.Issues) => void ) => void;

        time_entries: (params: QueryParams,
                 callback: (err: any, data: RedmineApi.TimeEntries) => void ) => void;
        
        create_time_entry: (params: ParamsCreateOrUpdateTimeEntryWrapped,
                            callback: (err: any) => void ) => void;
        
        update_time_entry: (id: number,
                            params: ParamsCreateOrUpdateTimeEntryWrapped,
                            callback: (err: any) => void ) => void;
    }
    
    interface QueryParams {
        limit?: number;
        offset?: number;
    }
    
    interface QueryParamsIssues extends QueryParams {
        issue_id?: string; //comma separated issue ids   
    }
    
    interface ParamsCreateOrUpdateTimeEntryWrapped {
        time_entry: ParamsCreateOrUpdateTimeEntry;
    }
    
    interface ParamsCreateOrUpdateTimeEntry {
        issue_id: number; // (only one is required): the issue id or project id to log time on
        project_id: number; // (only one is required): the issue id or project id to log time on
        spent_on: string; // the date the time was spent (default to the current date)
        hours: number; // (required): the number of spent hours
        activity_id?: number; //the id of the time activity. This parameter is required unless a default activity is defined in Redmine.
        comments: string; // short description for the entry (255 characters max)
    }
    
    // =========== ISSUE =========== 
    interface IssueProject {
        id: number;
        name: string;
    }
    interface IssueTracker {
        id: number;
        name: string;
    }

    interface IssueStatus {
        id: number;
        name: string;
    }

    interface IssuePriority {
        id: number;
        name: string;
    }
    interface IssueAuthor {
        id: number;
        name: string;
    }
    
    interface Issue {
        id: number;
        project: IssueProject;
        tracker: IssueTracker;
        status: IssueStatus;
        priority: IssuePriority;
        author: IssueAuthor;
        subject: string,
        description: string;
        start_date: string;
        done_ratio: number,
        created_on: string;
        updated_on: string;
    }
    
    interface Issues {
        issues: Issue[];
        total_count: number;
        offset: number;
        limit: number;
    }

    // =========== TIME ENTRY ===========

    interface TimeEntryProject {
        id: number;
        name: string;
    }

    interface TimeEntryIssue {
        id: number;
    }

    interface TimeEntryUser {
        id: number;
        name: string;
    }

    interface TimeEntryActivity {
        id: number;
        name: string;
    }
    
    interface TimeEntry {
        id: number;
        project: TimeEntryProject;
        issue: TimeEntryIssue;
        user: TimeEntryUser;
        activity: TimeEntryActivity;
        hours: number;
        comments: string;
        spent_on: string,
        created_on: string;
        updated_on: string;
    }
    
    interface TimeEntries {
        time_entries: TimeEntry[];
        total_count: number;
        offset: number;
        limit: number;
    }
}