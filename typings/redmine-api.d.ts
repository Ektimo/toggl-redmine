// partial definitions for API wrapper 'node-redmine', https://github.com/zanran/node-redmine/
// calls official Redmine REST api: http://www.redmine.org/projects/redmine/wiki/Rest_api
declare module RedmineApi {
    
    interface Client {
        // impersonate: string;
        
        users: (params: QueryParamsUsers,
                 callback: (err: any, data: RedmineApi.Users) => void ) => void;
        
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

    interface QueryParamsUsers extends QueryParams {
        // get only users with the given status. See app/models/principal.rb for a list of available statuses. Default is 1 (active users). Possible values are:
        //     1: Active (User can login and use their account)
        // 2: Registered (User has registered but not yet confirmed their email address or was not yet activated by an administrator. User can not login)
        // 3: Locked (User was once active and is now locked, User can not login)
        status?: string;   
        
        name?: string; // filter users on their login, firstname, lastname and mail ; if the pattern contains a space, it will also return users whose firstname match the first word or lastname match the second word
        group_id?: number; //get only users who are members of the given group
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

    // =========== USER =========== 

    interface User {
        id: number;
        login: string;
        firstname: string;
        lastname: string;
        mail: string;
        // THERE IS MORE ... (incomplete interface here, it suffices)
    }

    interface Users {
        users: User[];
        total_count: number;
        offset: number;
        limit: number;
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