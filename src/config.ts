export interface UserCredentialMapping {
    togglApiToken: string;
    togglWorkspaceId: number;
    togglUserId: number;
    redmineUsername: string;
    notificationsEmail: string;
}

export interface Config {
    redmineApiToken: string;
    redmineBaseUrl: string;
    lastMonthSyncExpiryDays: number;
    adminNotificationsEmail: string;
    smtpServer: string;
    smtpPassword: string;
    smtpUsername: string;
    smtpSender: string; // e.g. '"toggl-redmine sync" <redmine@somedomain.com>'
    userCredentialMappings: UserCredentialMapping[];
}