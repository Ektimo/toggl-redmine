import {TogglConnector} from "./toggl-connector";
import {RedmineConnector} from "./redmine-connector";
import moment = require("moment");
import cron = require("cron");
import logger from "./logger";
import {Config} from "./config";
import {Vector} from "prelude.ts";
import SyncError = RedmineConnector.SyncError;
import SyncSuccess = RedmineConnector.SyncSuccess;
import {Report} from "./report";
const config: Config = require('./../config.json');
const args = process.argv.slice(2);

async function sync() {
    const from = moment().subtract(1, 'months').startOf('month').format('YYYY-MM-DD');
    const to = moment().endOf('month').format('YYYY-MM-DD');

    let combinedSyncErrors: Vector<SyncError> = Vector.of();
    let combinedSuccessfulSyncs: Vector<SyncSuccess> = Vector.of();

    await Promise.all(Vector.ofIterable(config.userCredentialMappings)
        .map(async userConfig => {
            logger.info(`Querying Toggl data for user ${userConfig.redmineUsername}, from ${from} to ${to}`);
            const togglEntries = (await TogglConnector
                .getTogglEntries({
                    apiToken: userConfig.togglApiToken,
                    from: from,
                    to: to,
                    userId: userConfig.togglUserId,
                    workspaceId: userConfig.togglWorkspaceId
                }))
                .filter(x => !x.description.includes("#ignore"));

            togglEntries.filter(x => x.uid !== userConfig.togglUserId)
                .forEach(x => { throw new Error(`Expected time entries with user ID ${userConfig.togglUserId} (${userConfig.redmineUsername}), but got ${x.uid}`) });
            
            logger.info(`Loaded ${togglEntries.length()} entries for user ${userConfig.redmineUsername}`);

            const processedEntries = await RedmineConnector.syncTogglEnties(
                {
                    apiToken: config.redmineApiToken,
                    baseUrl: config.redmineBaseUrl,
                    from: from,
                    to: to,
                    redmineUsername: userConfig.redmineUsername,
                    togglUserId: userConfig.togglUserId,
                    lastMonthSyncExpiryDays: config.lastMonthSyncExpiryDays,
                    updateEntriesAsAdminUser: config.updateEntriesAsAdminUser
                },
                togglEntries);
            const [syncErrors, successfulSyncs] = processedEntries.partition(RedmineConnector.isSyncError);
            combinedSyncErrors = combinedSyncErrors.appendAll(syncErrors);
            combinedSuccessfulSyncs = combinedSuccessfulSyncs.appendAll(successfulSyncs);
            return processedEntries;
        }));

    Report.logSyncResults(combinedSyncErrors, combinedSuccessfulSyncs);
    await Report.sendMailReports(combinedSyncErrors, combinedSuccessfulSyncs);
}

if (args[0] === 'sync') {
    sync();
}

if (args[0] === 'syncCron') {
    const cronTime = '00 00 06 * * * ';
    const cronJob = new cron.CronJob({
        cronTime: cronTime,
        onTick: function () {
            sync();
        },
        start: false,
        runOnInit: true
    });
    logger.info(`Setting up cron job ${cronTime}`);
    cronJob.start();
}