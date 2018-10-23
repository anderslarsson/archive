'use strict';

const path          = require('path');
const dotenv        = require('dotenv');
const request       = require('request');

class Api {

    constructor() {
        this.accessToken = null;
        this.idToken     = null;

        this.initialized = false;

        this.targetEnv = 'devbox';

        let env = dotenv.config({path: path.resolve(process.cwd(), '.env.local')});
        if (env.error) {
            const msg = 'Failed to load secrects from ENV. Can not login.';
            console.log(msg);
            throw new Error(msg);
        }
    }

    get hostsConfig() {
        return {
            devbox: {
                host: 'localhost',
                port: '8080',
                scheme: 'http',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_DEV
            },
            dev: {
                host: 'develop.businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_DEV
            },
            stage: {
                host: 'stage.businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD_STAGE,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_STAGE
            },
            prod: {
                host: 'businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD_STAGE,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_PROD
            }
        };
    }

    async init(targetEnv = 'devbox') {
        this.targetEnv = targetEnv;

        if (this.initialized !== false) {
            return true;
        }

        // TODO Add accessToken renewal

        if (!this.accessToken) {
            let authResult = await this.fetchApiAccessToken();
            if (!authResult.access_token) {
                const msg = 'Failed to fetch accessToken. Can not login.';
                console.log(msg);
                throw new Error(msg);
            }
            if (!authResult.id_token) {
                const msg = 'Failed to fetch idToken. Can not login.';
                console.log(msg);
                throw new Error(msg);
            }

            this.accessToken = authResult.access_token;
            this.idToken = authResult.id_token;

            console.info('API#init: Successfully fetched access token:');
        }

        return this.initialized = true;
    }

    applyBaseUrl(pathOrUrl) {
        if (pathOrUrl.startsWith('http')) {
            return pathOrUrl;
        } else {
            let config = this.hostsConfig[this.targetEnv];

            return `${config.scheme}://${config.host}:${config.port}${pathOrUrl}`;
        }
    }

    applyAuthHeaders(headers = {}) {
        return Object.assign(headers, {
            'Authorization': 'Bearer ' + this.accessToken,
            'X-USER-ID-TOKEN': this.idToken
        });
    }

    async head(url) {
        if (!this.initialized) {
            await this.init();
        }

        let options = {
            url: this.applyBaseUrl(url),
            method: 'HEAD',
            headers: this.applyAuthHeaders()
        };

        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({res, body});
                };
            });
        });
    }

    async patchJson(url, json) {
        if (!this.initialized) {
            await this.init();
        }

        let options = {
            url: this.applyBaseUrl(url),
            method: 'PATCH',
            headers: this.applyAuthHeaders(),
            json
        };

        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    if (body && typeof body === 'string') {
                        let parsed;
                        try {
                            parsed = JSON.parse(body);
                            resolve(parsed, res);
                        } catch (e) {
                            console.error('API#patchJson: Failed to parse response. ', e);
                            reject(e);
                        }
                    } else {
                        resolve(body);
                    }
                };
            });
        });
    }

    async postJson(url, json) {
        if (!this.initialized) {
            await this.init();
        }

        let options = {
            url: this.applyBaseUrl(url),
            method: 'POST',
            headers: this.applyAuthHeaders(),
            json
        };

        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    if (body && typeof body === 'string') {
                        let parsed;
                        try {
                            parsed = JSON.parse(body);
                            resolve(parsed);
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        resolve(body);
                    }
                };
            });
        });
    }

    async putChunked(url, buffer) {
        if (!this.initialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            let options = {
                url: this.applyBaseUrl(url),
                method: 'PUT',
                headers: this.applyAuthHeaders(),
                body: buffer
            };

            request(options, (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    if (body) {
                        let parsed;
                        try {
                            parsed = JSON.parse(body);
                            resolve(parsed);
                        } catch (e) {
                            console.error('Api#putChunked: Malformed JSON received.');
                            reject(e);
                        }
                    } else {
                        // FIXME
                        resolve(body);
                    }
                };
            });
        });
    }

    async fetchApiAccessToken() {
        const config = this.hostsConfig[this.targetEnv];

        let options = {
            url: this.applyBaseUrl('/auth/token'),
            method: 'POST',
            // headers: {
            //     'Authorization': `Basic ${process.env.TOKEN_AUTH_BEARER}`
            // },
            auth: {
                username: 'oidcCLIENT',
                password: config.clientSecret
            },
            form: {
                'grant_type': 'password',
                'username': config.username,
                'password': config.password,
                'scope': 'email phone userInfo roles'
            }
        };

        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) reject(err);

                if (body) {
                    let result = JSON.parse(body);

                    resolve(result);
                } else {
                    reject('Empty response');
                }
            });

        });
    }

}

module.exports = new Api;
