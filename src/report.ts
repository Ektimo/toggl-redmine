import {RedmineConnector} from "./redmine-connector";
import moment = require("moment");
import logger from "./logger";
import {Config, UserCredentialMapping} from "./config";
import {instanceOf, Option, Vector} from "prelude.ts";
import SyncError = RedmineConnector.SyncError;
import SyncSuccess = RedmineConnector.SyncSuccess;
import os = require('os');
import {Helper} from "./helper";
import combineWithArrowIfNotEqual = Helper.combineWithArrowIfNotEqual;
import * as nodemailer from 'nodemailer';
import Bottleneck from "bottleneck"
import {encodeXText} from "nodemailer/lib/shared";


export module Report {
    
    // throttle for 10 seconds between sending emails (don't completely flood the inbox in case of any accidental loops)
    const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: 10000
    });
    
    const config: Config = require('./../config.json');
    const Table = require('cli-table2');

    const tablePlainStyle = {
        compact: true,
        head: [],    //disable colors in header cells
        border: []  //disable colors for the border
    };

    const tableColorStyle = {
        compact: true
    };

    function getNopTable(successfulSyncs: Vector<SyncSuccess>, colors = true) {
        const nopTable = new Table({
            head: ['user', 'date', '#', 'h', 'description'],
            colWidths: [20, 12, 6, 7, 100],
            style: colors ? tableColorStyle : tablePlainStyle,
            wordWrap: true
        });

        nopTable.push(...successfulSyncs
            .filter(x => x.action === 'nop')
            .map(x => [getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
                x.newEntry.spent_on,
                String(x.newEntry.issue_id),
                String(x.newEntry.hours),
                `'${x.newEntry.comments}'`
            ])
            .toArray());

        return nopTable;
    }

    function getSuccessTable(successfulSyncs: Vector<SyncSuccess>, colors = true) {
        const successTable = new Table({
            head: ['action', 'user', 'date', '#', 'h', 'description'],
            colWidths: [8, 20, 27, 15, 17, 120],
            style: colors ? tableColorStyle : tablePlainStyle,
            wordWrap: true
        });

        successTable.push(...successfulSyncs
            .filter(x => x.action !== 'nop')
            .map(x => {
                return x.action === 'create' ?
                    [
                        x.action,
                        getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
                        x.newEntry.spent_on,
                        String(x.newEntry.issue_id),
                        String(x.newEntry.hours),
                        `'${x.newEntry.comments}'`]
                    : [
                        x.action,
                        getUserForTogglUserId(x.togglEntry.uid).redmineUsername,
                        combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().spent_on, x.newEntry.spent_on),
                        combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().issue.id, x.newEntry.issue_id),
                        combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().hours, x.newEntry.hours),
                        combineWithArrowIfNotEqual(Option.ofNullable(x.existingEntry).getOrThrow().comments, x.newEntry.comments)
                    ];
            })
            .toArray());

        return successTable;
    }

    function getErrorTable(syncErrors: Vector<SyncError>, colors = true) {
        const errorTable = new Table({
            head: ['user', 'date / type', 'description', "ERROR message"],
            colWidths: [20, 16, 100, 75],
            style: colors ? tableColorStyle : tablePlainStyle,
            wordWrap: true
        });
        
        errorTable.push(...syncErrors
            .map(x => {
                if (Helper.isTogglEntry(x.entry)) {
                    return [getUserForTogglUserId(x.togglUserId).redmineUsername,
                        '  ' + moment(x.entry.start).format('YYYY-MM-DD') + ' →',
                        `'${x.entry.description}'`,
                        `'${x.errorMessage}'`]
                }
                else {
                    return [getUserForTogglUserId(x.togglUserId).redmineUsername,
                        '← ' + moment(x.entry.spent_on).format('YYYY-MM-DD'),
                        `'${x.entry.comments}'`,
                        `'${x.errorMessage}'`]
                }
            })
            .toArray());

        return errorTable;
    }

    export function logSyncResults(syncErrors: Vector<SyncError>, successfulSyncs: Vector<SyncSuccess>) {
        const nopTable = getNopTable(successfulSyncs);
        const successTable = getSuccessTable(successfulSyncs);
        const errorTable = getErrorTable(syncErrors);

        logger.info("Successfully checked (nop):");
        logger.info(os.EOL + nopTable.toString());

        logger.info("Successfully synced (create/update):");
        logger.info(os.EOL + successTable.toString());

        logger.error("Failed to sync:");
        logger.error(os.EOL + errorTable.toString());
    }

    export async function sendFatalErrorReport(err: string) {
        return sendMail(config.adminNotificationsEmail,
            "[Toggl-Redmine] Sync FATAL ERROR",
            `<pre>${err}</pre>`);
    }
    
    export async function sendMailReports(syncErrors: Vector<SyncError>, successfulSyncs: Vector<SyncSuccess>) {
        // send aggregated report to admin (each sync)
        const nopTable = getNopTable(successfulSyncs, false);
        const successTable = getSuccessTable(successfulSyncs, false);
        const errorTable = getErrorTable(syncErrors, false);
        
        let actions: Vector<Promise<any>> = Vector.of();
        
        // admin report
        if(errorTable.length !== 0) {
            actions = actions.append(
                sendMail(config.adminNotificationsEmail,
                    "[Toggl-Redmine] Sync ERROR (admin report)",
                    `<pre>ERRORS: <br />${errorTable.toString()}<br />Successfully synced:<br />${successTable.toString()}<br />No changes:<br />${nopTable.toString()}`
                )
            );
        }
        else if(successTable.length !== 0) {
            actions = actions.append(
                sendMail(config.adminNotificationsEmail,
                    "[Toggl-Redmine] Sync success (admin report)",
                    `<pre>Successfully synced:<br />${successTable.toString()}<br />No changes:<br /> ${nopTable.toString()}</pre>`
                )
            );
        }

        // user reports
        actions = actions.appendAll(
            syncErrors
                .groupBy(x => x.togglUserId)
                .map((togglUserId, userSyncErrors) => {
                    const userErrorTable = getErrorTable(userSyncErrors, false);
                    const userSuccessTable = getSuccessTable(successfulSyncs.filter(x => x.togglEntry.uid === togglUserId), false);
                    const userNopTable = getNopTable(successfulSyncs.filter(x => x.togglEntry.uid === togglUserId), false);
                    const sendMailPromise = sendMail(getUserForTogglUserId(togglUserId).notificationsEmail,
                        "[Toggl-Redmine] Sync ERROR",
                        `<pre>ERRORS: <br />${userErrorTable.toString()}<br />Successfully synced:<br />${userSuccessTable.toString()}<br />No changes:<br />${userNopTable.toString()}`
                    );
                    return [togglUserId, sendMailPromise];
                    })
                .valueIterable()
        );

        return Promise.all(actions);
    }

    async function sendMail(to: string, subject: string, htmlContent: string) {
        const smtpConfig = {
            host: config.smtpServer,
            port: 587,
            // set to false and used tls configuration below, just using true somehow doesn't work:
            // https://github.com/dialogflow/dialogflow-nodejs-client-v2/issues/89
            secure: false,
            auth: {
                user: config.smtpUsername,
                pass: config.smtpPassword
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false // https://stackoverflow.com/questions/14262986/node-js-hostname-ip-doesnt-match-certificates-altnames
            }
        };
        
        let transporter = nodemailer.createTransport(smtpConfig);

        // setup email data with unicode symbols
        let mailOptions = {
            from: `"toggl-redmine sync" <${config.smtpSender}>`,
            to: to, // comma separated list of receivers
            subject: subject,
            html: htmlContent, // html body
        };

        return limiter.schedule(() => {
                logger.info(`Sending email '${mailOptions.subject}' to ${mailOptions.to}`);
                return transporter.sendMail(mailOptions);
            })
            .then(info => logger.info('Message sent: %s', info.messageId))
            .catch(error => logger.error(`Failed to send mail to ${to}, message: ${error}`));
    }

    function getUserForTogglUserId(togglUserId: number): UserCredentialMapping {
        return Vector.ofIterable(config.userCredentialMappings).filter(x => x.togglUserId === togglUserId).single().getOrThrow();
    }
}