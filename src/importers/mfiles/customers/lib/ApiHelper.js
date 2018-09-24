const axios = require('axios');
const extend = require('extend');
const qs = require('qs');
const path = require('path');
const dotenv = require('dotenv');

const defaultConfig = {
    username: 'ocadmin',
    password: 'test',
    scheme: 'https',
    host: 'develop.businessnetwork.opuscapita.com',
    port: '443',
    clientId: 'oidcCLIENT',
    instanceId: 'ApiHelper'
};

/**
 * Takes the configuration and initializes a new API session, then
 * stores the access token for subsequent requests
 *
 */
module.exports = class ApiHelper {

    constructor(config) {
        this.tokenInfo = null;

        let env = dotenv.config({path: path.resolve(process.cwd(), '.env.local')});
        if (env.error) {
            const msg = 'Failed to load secrects from ENV. Can not login.';
            console.log(msg);
            throw new Error(msg);
        }

        this.config = extend(true, {}, defaultConfig, config);
    }

    init() {
        this.http = axios.create(extend(true, {}, this.config.http));

        let data = qs.stringify({'grant_type': 'password',
            'username': this.config.username,
            'password': this.config.password,
            'scope': 'email phone userInfo roles'
        });

        const tokenUrl = this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/auth/token";

        debugger;

        return this.http.post(tokenUrl,
            data,
            {
                // headers: {
                //     'Authorization': `Basic ${process.env.TOKEN_AUTH_BEARER}`
                // }
                auth: {
                    username: this.config.clientId,
                    password: process.env.TOKEN_AUTH_CLIENT_SECRET_DEV
                }
            }
        ).then( (response) => {
            console.log("received response for " + tokenUrl + ": " + response.status);
            this.tokenInfo = response.data;
            this.tokenInfo.expires_at = new Date(this.tokenInfo.expires_in * 1000 + new Date().getTime()).getTime();
            console.log(this.config.instanceId + ' received access_token ' + this.tokenInfo.access_token + "\nvalid until %o", new Date(this.tokenInfo.expires_at));
            return this;
        })
            .catch((err) => {
                console.log(this.config.instanceId + " Error getting access token: %o", err);
                throw err;
            });
    }

    /**
     * Makes sure we have a valid access_token and returns a Promise on the
     * Auth header value to be used for authenticating API calls
     */
    ensureSession() {
        if (!this.tokenInfo) {
            return Promise.reject('ApiHelper not initialized! Call init(config) first...');
        }
        if(new Date().getTime() > this.tokenInfo.expires_at - 5000) {
            console.log(this.config.instanceId + " refreshing token which is valid until %o", new Date(this.tokenInfo.expires_at));
            return this.init({});
        }
        return Promise.resolve(this.getAuthHeader());
    }

    getAuthHeader() {
        return this.tokenInfo.token_type + " " + this.tokenInfo.access_token;
    }

    /**
     * Wrapper around axios put, will take care of API session handling
     * and schema host, port.
     * For usage just start uri with serviceName, e.g. blob/api/c_ncc/files/some/file
     * returns a Promise on the response
     */
    put(uri, data, config) {
        return this.ensureSession()
            .then( (authHeader) => {
                return this.http.put(this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/" + uri, data, extend(true, {}, config, {headers: {Authorization: authHeader}}));
            });
    }

    /**
     * Wrapper around axios post, will take care of API session handling
     * and schema host, port.
     * For usage just start uri with serviceName, e.g. blob/api/c_ncc/files/some/file
     * returns a Promise on the response
     */
    post(uri, data, config) {
        return this.ensureSession()
            .then( (authHeader) => {
                return this.http.post(this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/" + uri,
                    data,
                    extend(true, {}, config, {
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json'
                        }
                    }));
            });
    }

    /**
     * Wrapper around axios get, will take care of API session handling
     * and schema host, port.
     * For usage just start uri with serviceName, e.g. blob/api/c_ncc/files/some/file
     * returns a Promise on the response
     */
    get(uri, config) {
        return this.ensureSession()
            .then( (authHeader) => {
                return this.http.get(this.config.scheme + "://" + this.config.host + ":" + this.config.port + "/" + uri, extend(true, {}, config, {headers: {Authorization: authHeader}}));
            });
    }
}
