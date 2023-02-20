import { PostHog } from 'posthog-node';
import { getBaseUrl, localhostUrl, dirname, isCloud, UserType } from '../utils/utils.js';
import ip from 'ip';
import errorManager from './error.manager.js';
import { readFileSync } from 'fs';
import path from 'path';

class Analytics {
    client: PostHog | undefined;
    packageVersion: string | undefined;

    constructor() {
        try {
            if (process.env['TELEMETRY']?.toLowerCase() !== 'false') {
                this.client = new PostHog('phc_4S2pWFTyPYT1i7zwC8YYQqABvGgSAzNHubUkdEFvcTl');
                this.client.enable();
                this.packageVersion = JSON.parse(readFileSync(path.resolve(dirname(), '../../package.json'), 'utf8')).version;
            }
        } catch (e) {
            errorManager.report(e);
        }
    }

    public track(name: string, accountId: number, properties?: Record<string | number, any>) {
        try {
            if (this.client == null) {
                return;
            }

            properties = properties || {};
            let userProperties = {} as Record<string | number, any>;

            let baseUrl = getBaseUrl();
            let userType = this.getUserType(accountId, baseUrl);
            let userId = this.getUserIdWithType(userType, accountId, baseUrl);

            properties['host'] = baseUrl;
            properties['user-type'] = userType;
            properties['user-account'] = userId;
            properties['nango-server-version'] = this.packageVersion || 'unkown';

            userProperties['user-type'] = userType;
            userProperties['account'] = userId;
            properties['$set'] = userProperties;

            this.client.capture({
                event: name,
                distinctId: userId,
                properties: properties
            });
        } catch (e) {
            errorManager.report(e, accountId);
        }
    }

    public getUserType(accountId: number, baseUrl: string): UserType {
        if (baseUrl === localhostUrl) {
            return UserType.Local;
        } else if (accountId === 0) {
            return UserType.SelfHosted;
        } else {
            return UserType.Cloud;
        }
    }

    public getUserIdWithType(userType: string, accountId: number, baseUrl: string): string {
        switch (userType) {
            case UserType.Local:
                return `${userType}-${ip.address()}`;
            case UserType.SelfHosted:
                return `${userType}-${baseUrl}`;
            case UserType.Cloud:
                return `${userType}-${(accountId || 0).toString()}`;
            default:
                return 'unknown';
        }
    }

    public identify(accountId: number, email: string) {
        try {
            if (this.client == null || !isCloud()) {
                return;
            }

            let baseUrl = getBaseUrl();
            let userType = this.getUserType(accountId, baseUrl);

            this.client.identify({
                distinctId: this.getUserIdWithType(userType, accountId, getBaseUrl()),
                properties: {
                    email: email
                }
            });
        } catch (e) {
            errorManager.report(e, accountId);
        }
    }
}

export default new Analytics();
