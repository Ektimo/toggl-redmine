import {TogglConnector} from "./toggl-connector";
import {RedmineConnector} from "./redmine-connector";
import moment = require("moment");
import cron = require("cron");
import logger from "./logger";
import {Config, UserCredentialMapping} from "./config";
import {Option, Vector} from "prelude.ts";
import SyncError = RedmineConnector.SyncError;
import SyncSuccess = RedmineConnector.SyncSuccess;
import os = require('os');
import {Helper} from "./helper";
import combineWithArrowIfNotEqual = Helper.combineWithArrowIfNotEqual;
const config: Config = require('./../config.json');
const Table = require('cli-table2');
const nodemailer = require('nodemailer');

const args = process.argv.slice(2);

async function sync() {
    const from = moment().subtract(1,'months').startOf('month').format('YYYY-MM-DD');
    const to = moment().endOf('month').format('YYYY-MM-DD');
    
    let combinedSyncErrors: Vector<SyncError> = Vector.of();    
    let combinedSuccessfulSyncs: Vector<SyncSuccess> = Vector.of();
    
    await Promise.all(Vector.ofIterable(config.userCredentialMappings)
        .map(async userConfig => {
            logger.info(`Querying Toggl data for user ${userConfig.redmineUsername}`);
            let togglEntries = await TogglConnector
                .getTogglEntries({
                    apiToken: userConfig.togglApiToken,
                    from: from,
                    to: to,
                    userId: userConfig.togglUserId,
                    workspaceId: userConfig.togglWorkspaceId
                });
            
            if(togglEntries.anyMatch(x => x.uid !== userConfig.togglUserId))
                throw new Error("Each entry 'user id' should match currently processed user 'id'")

            logger.info(`Acquired ${togglEntries.length()} entries for user ${userConfig.redmineUsername}`);

            const processedEntries = await RedmineConnector.syncTogglEnties(
                {
                    apiToken: config.redmineApiToken,
                    baseUrl: config.redmineBaseUrl,
                    from: from,
                    to: to,
                    redmineUsername: userConfig.redmineUsername,
                    togglUserId: userConfig.togglUserId
                },
                togglEntries);
            let [syncErrors, successfulSyncs] = processedEntries.partition(RedmineConnector.isSyncError);
            combinedSyncErrors = combinedSyncErrors.appendAll(syncErrors);
            combinedSuccessfulSyncs = combinedSuccessfulSyncs.appendAll(successfulSyncs);
            return processedEntries;
        }));

    report(combinedSyncErrors, combinedSuccessfulSyncs);
}

function report(syncErrors: Vector<SyncError>, successfulSyncs: Vector<SyncSuccess>) {
    const nopTable = new Table({
        head: ['action', 'user', 'date', '#', 'h', 'description'],
        colWidths: [8, 20, 12, 6, 7, 60],
        style: {compact: true},
        wordWrap: true
    });

    nopTable.push(...successfulSyncs
        .filter(x => x.action === 'nop')
        .flatMap(x => Vector.of(
            x.action,
            getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
            x.newEntry.spent_on,
            String(x.newEntry.issue_id),
            String(x.newEntry.hours),
            `'${x.newEntry.comments}'`
        ))
        .toArray());

    const successTable = new Table({
        head: ['action', 'user', 'date', '#', 'h', 'description'],
        colWidths: [8, 20, 27, 15, 17, 120],
        style: {compact: true},
        wordWrap: true
    });

    successTable.push(...successfulSyncs
        .filter(x => x.action !== 'nop')
        .flatMap(x => {
            return x.action === 'create' ?
                Vector.of(
                    x.action,
                    getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
                    x.newEntry.spent_on,
                    String(x.newEntry.issue_id),
                    String(x.newEntry.hours),
                    `'${x.newEntry.comments}'`)
                : Vector.of(
                    x.action,
                    getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
                    combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().spent_on, x.newEntry.spent_on),
                    combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().issue.id, x.newEntry.issue_id),
                    combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().hours, x.newEntry.hours),
                    combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().comments, x.newEntry.comments)
                );
        })
        .toArray());

    const errorTable = new Table({
        head: ['user', 'date', 'description', "ERROR message"],
        colWidths: [20, 12, 100, 75],
        style: {compact: true},
        wordWrap: true
    });

    errorTable.push(...syncErrors
        .map(x => [getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
            moment(x.togglEntry.start).format('YYYY-MM-DD'),
            `'${x.togglEntry.description}'`,
            `'${x.errorMessage}'`])
        .toArray());

    logger.info("Successfully checked (nop):")
    logger.info(os.EOL + nopTable.toString());

    logger.info("Successfully synced (create/update):")
    logger.info(os.EOL + successTable.toString());

    logger.error("Failed to sync:")
    logger.error(os.EOL + errorTable.toString());
}

function getUserForTogglUserId(togglUserId: number): UserCredentialMapping {
    return Vector.ofIterable(config.userCredentialMappings).filter(x => x.togglUserId === togglUserId).single().getOrThrow();
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