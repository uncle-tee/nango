/*
 * Copyright (c) 2022 Nango, all rights reserved.
 */

import type { Express } from 'express';
import db from './db/database.js';
import oauthController from './controllers/oauth.controller.js';
import configController from './controllers/config.controller.js';
import connectionController from './controllers/connection.controller.js';
import auth from './controllers/access.middleware.js';
import path from 'path';
import { dirname, isCloud, getAccount, isAuthenticated } from './utils/utils.js';
import accountController from './controllers/account.controller.js';
import errorManager from './utils/error.manager.js';

class AuthServer {
    async setup(app: Express) {
        await db.knex.raw(`CREATE SCHEMA IF NOT EXISTS ${db.schema()}`);
        await db.migrate(path.join(dirname(), '../../lib/db/migrations'));

        // Healthcheck.
        app.get('/', (_, res) => {
            res.status(200).send({ result: 'ok' });
        });

        // Main routes.
        app.route('/oauth/connect/:providerConfigKey').get(auth.public.bind(auth), oauthController.oauthRequest.bind(oauthController));
        app.route('/oauth/callback').get(oauthController.oauthCallback.bind(oauthController));
        app.route('/config').get(auth.secret.bind(auth), configController.listProviderConfigs.bind(configController));
        app.route('/config/:providerConfigKey').get(auth.secret.bind(auth), configController.getProviderConfig.bind(configController));
        app.route('/config').post(auth.secret.bind(auth), configController.createProviderConfig.bind(configController));
        app.route('/config').put(auth.secret.bind(auth), configController.editProviderConfig.bind(configController));
        app.route('/config/:providerConfigKey').delete(auth.secret.bind(auth), configController.deleteProviderConfig.bind(configController));
        app.route('/connection/:connectionId').get(auth.secret.bind(auth), connectionController.getConnectionCreds.bind(connectionController));
        app.route('/connection').get(auth.secret.bind(auth), connectionController.listConnections.bind(connectionController));
        app.route('/connection/:connectionId').delete(auth.secret.bind(auth), connectionController.deleteConnection.bind(connectionController));

        // Admin routes.
        if (isCloud()) {
            app.route('/account').post(auth.admin.bind(auth), accountController.createAccount.bind(accountController));
        }

        // Error handling.
        app.use((e: any, _: any, res: any, __: any) => {
            if (isAuthenticated(res)) {
                errorManager.report(e, getAccount(res));
            } else {
                errorManager.report(e);
            }
            errorManager.res(res, 'server_error');
        });
    }
}

export default new AuthServer();
