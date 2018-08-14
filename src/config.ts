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

    userCredentialMappings: UserCredentialMapping[];
}