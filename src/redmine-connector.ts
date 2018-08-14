import {Helper} from "./helper";
import {Vector} from "prelude.ts";
import moment = require("moment");
import logger from "./logger";
let Redmine = require('node-redmine');

export module RedmineConnector {

    export interface SyncParameters {
        apiToken: string;
        baseUrl: string;
        from: string; //YYYY-MM-DD format
        to: string; //YYYY-MM-DD format
        togglUserId: number;
        redmineUsername: string;
    }
    
    // Redmine API docs: 
    // offset: the offset of the first object to retrieve
    // limit: the number of items to be present in the response (default is 25, maximum is 100)
    const queryPageLimit = 100;
    
    export interface SyncSuccess {
        togglEntry: TogglApi.TimeEntry;
        existingEntry: RedmineApi.TimeEntry | null;
        newEntry: RedmineApi.ParamsCreateOrUpdateTimeEntry;
        action: 'create' | 'update' | 'nop';
    }

    export interface SyncError {
        togglEntry: TogglApi.TimeEntry;
        errorMessage: string;
    }

    export function isSyncError(item: SyncSuccess | SyncError): item is SyncError{
        return (<SyncError>item).errorMessage !== undefined;
    }
    
    function matchesBySuffixKey(redmineTimeEntry: RedmineApi.TimeEntry, togglEntry: TogglApi.TimeEntry) {
        return redmineTimeEntry.comments.endsWith(`[${togglEntry.id}]`)
    }
    
    function getRedmineTimeEntryDescriptionWithKey(togglEntry: TogglApi.TimeEntry) {
        return togglEntry.description + ` [${togglEntry.id}]`
    }
    
    export async function syncTogglEnties(syncParams: SyncParameters, togglEntries: Vector<TogglApi.TimeEntry>): Promise<Vector<SyncSuccess | SyncError>> {
        logger.info(`Creating Redmine client, impersonating user ${syncParams.redmineUsername}`);
        let redmineApiClient = <RedmineApi.Client>new Redmine(syncParams.baseUrl, { apiKey: syncParams.apiToken, impersonate: syncParams.redmineUsername});
        
        let referencedIssueIds = togglEntries
            .mapOption(x => Helper.extractSingleHashtagNumber(x.description));
        
        let redmineIssues = await queryRedmineIssues(redmineApiClient, referencedIssueIds);
        let redmineTimeEntries = await queryRedmineTimeEntries(redmineApiClient, 1);
                
        return Vector.ofIterable(
            await Promise.all(
                togglEntries.map(async x => await syncTogglEntry(redmineApiClient, syncParams, x, redmineIssues, redmineTimeEntries)
                )
            )
        );
    }

    async function syncTogglEntry(
        redmineApiClient: RedmineApi.Client,
        syncParams: SyncParameters,
        togglEntry: TogglApi.TimeEntry,
        redmineIssues: Vector<RedmineApi.Issue>,
        redmineTimeEntries: Vector<RedmineApi.TimeEntry>
    ): Promise<SyncSuccess | SyncError> {
        try {
            const issueId = Helper
                .extractSingleHashtagNumber(togglEntry.description).getOrThrow("Missing issue hashtag");

            const matchingRedmineIssue = redmineIssues
                .filter(x => x.id === issueId)
                .single()
                .getOrThrow(`No matching Redmine issue #${issueId} found`);

            const spentOn = moment(togglEntry.start).format('YYYY-MM-DD');
            const hours = Number(
                moment(togglEntry.end)
                    .diff(moment(togglEntry.start), 'hours', true)
                    .toPrecision(2)
            );

            const existingMatchingEntries = redmineTimeEntries.filter(x => matchesBySuffixKey(x, togglEntry));

            const paramsCreateOrUpdateTimeEntry: RedmineApi.ParamsCreateOrUpdateTimeEntry = {
                issue_id: matchingRedmineIssue.id,
                project_id: matchingRedmineIssue.project.id,
                hours: hours,
                // activity_id:
                comments: getRedmineTimeEntryDescriptionWithKey(togglEntry),
                spent_on: spentOn
            };
                
            if(existingMatchingEntries.isEmpty()) {
                await createRedmineTimeEntry(redmineApiClient, paramsCreateOrUpdateTimeEntry);

                return <SyncSuccess>{
                    togglEntry: togglEntry,
                    existingEntry: null,
                    newEntry: paramsCreateOrUpdateTimeEntry,
                    action: "create"
                }
            }
            else {
                const existingEntry = existingMatchingEntries
                    .single()
                    .getOrThrow(`Multiple matches found for toggl entry ${togglEntry.id}, user ${syncParams.redmineUsername}`);

                if (existingEntry.issue.id !== paramsCreateOrUpdateTimeEntry.issue_id ||
                    existingEntry.project.id !== paramsCreateOrUpdateTimeEntry.project_id ||
                    existingEntry.hours !== paramsCreateOrUpdateTimeEntry.hours ||
                    existingEntry.comments !== paramsCreateOrUpdateTimeEntry.comments ||
                    existingEntry.spent_on !== paramsCreateOrUpdateTimeEntry.spent_on) {
                    await updateRedmineTimeEntry(redmineApiClient, existingEntry.id, paramsCreateOrUpdateTimeEntry);

                    return <SyncSuccess>{
                        togglEntry: togglEntry,
                        existingEntry: existingEntry,
                        newEntry: paramsCreateOrUpdateTimeEntry,
                        action: "update"
                    }
                }

                return <SyncSuccess>{
                    togglEntry: togglEntry,
                    existingEntry: existingEntry,
                    newEntry: paramsCreateOrUpdateTimeEntry,
                    action: "nop"
                }    
            }
            
            throw new Error("Broken sync code, this line should be unreachable.")
        }
        catch (error) {
            return <SyncError>{
                togglEntry: togglEntry,
                errorMessage: error
            };
        }
    }

    async function queryRedmineIssues(redmineApiClient: RedmineApi.Client, issueIds: Vector<number>) {
        return new Promise<Vector<RedmineApi.Issue>>((resolve, reject) => {
            let commaSeparatedIssueIds = issueIds.mkString(',');
            logger.info(`Querying ${issueIds.length()} Redmine issues: "${commaSeparatedIssueIds}"`);
            redmineApiClient.issues({limit: queryPageLimit, issue_id: commaSeparatedIssueIds},
                (err: any, data: RedmineApi.Issues) => {
                    if (err !== null) {
                        return reject(new Error("Failed to retrieve redmine issues: " + JSON.stringify(err)));
                    }
                    const issues = Vector.ofIterable(data.issues);
                    logger.info(`Acquired ${issues.length()} Redmine issues: "${issues.map(x => x.id).mkString(',')}"`);

                    if (data.total_count >= data.limit) {
                        return reject(new Error(`Not implemented: Toggle entries reference ${data.total_count}, which is more than one page of Redmine issues.`))
                    }

                    resolve(issues);
                });
        })
    }

    async function queryRedmineTimeEntries(redmineApiClient: RedmineApi.Client, page: number) {
        return new Promise<Vector<RedmineApi.TimeEntry>>((resolve, reject) => {
            logger.info(`Querying time entries page ${page}`)
            redmineApiClient.time_entries({limit: queryPageLimit, offset: (page - 1) * queryPageLimit},
                async function (err: any, data: RedmineApi.TimeEntries) {
                    if (err !== null) {
                        return reject(new Error("Failed to retrieve redmine time entries: " + JSON.stringify(err)));
                    }
                    let timeEntriesTail = Vector.ofIterable(data.time_entries);
                    logger.info(`Acquired ${timeEntriesTail.length()} time entries`);

                    if (page * data.limit < data.total_count) {
                        const timeEntriesNextPage = await queryRedmineTimeEntries(redmineApiClient, page + 1);
                        timeEntriesTail = timeEntriesTail.appendAll(timeEntriesNextPage);                        
                    }

                    resolve(timeEntriesTail);
                });
        })
    }

    async function createRedmineTimeEntry(redmineApiClient: RedmineApi.Client, params: RedmineApi.ParamsCreateOrUpdateTimeEntry) {
        return new Promise<void>((resolve, reject) => {
            logger.info(`Creating Redmine time entry ${JSON.stringify(params)}`);
            redmineApiClient.create_time_entry({time_entry: params},
                (err: any) => {
                    if (err !== null) {
                        return reject(new Error("Failed to create redmine time entry: " + JSON.stringify(err)));
                    }
                    logger.info(`Successfully created time entry"`);
                    resolve();
                });
        })
    }

    async function updateRedmineTimeEntry(redmineApiClient: RedmineApi.Client, timeEntryId: number, params: RedmineApi.ParamsCreateOrUpdateTimeEntry) {
        return new Promise<Vector<RedmineApi.Issue>>((resolve, reject) => {
            logger.info(`Updating Redmine time entry '${timeEntryId}' with data ${JSON.stringify(params)}`);
            redmineApiClient.update_time_entry(timeEntryId, {time_entry: params},
                (err: any) => {
                    if (err !== null) {
                        return reject(new Error("Failed to update redmine time entry: " + JSON.stringify(err)));
                    }
                    logger.info(`Successfully updated time entry`)
                    resolve();
                });
        })
    }
}
