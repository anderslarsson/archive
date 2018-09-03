'use strict';

const path          = require('path');
const dotenv        = require('dotenv').config({path: path.resolve(process.cwd(), '.env.local')});
const request       = require('request');

console.log(dotenv.parsed);

class Api {

    constructor() {
        this.accessToken = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized !== false) {
            return true;
        }

        // TODO Add accessToken renewal

        if (!this.accessToken) {
            this.accessToken = await this.fetchApiAccessToken();
        }

        return this.initialized = true;
    }

    postJson(url, json) {
        let options = {
            url,
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.accessToken
            },
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

    putChunked(url, buffer) {
        return new Promise((resolve, reject) => {
            let options = {
                url: url,
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.accessToken
                },
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
        let options = {
            url: 'http://localhost:8080/auth/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${process.env.TOKEN_AUTH_BEARER}`
            },
            form: {
                'grant_type': 'password',
                'username': process.env.TOKEN_AUTH_USERNAME,
                'password': process.env.TOKEN_AUTH_PASSWORD,
                'scope': 'email phone userInfo roles'
            }
        };

        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) reject(err);

                if (body) {
                    let result = JSON.parse(body);

                    resolve(result.access_token);
                } else {
                    reject('Empty response');
                }
            });

        });

        // let result;
        // try {
        //     result = await request.post('http://localhost:8080/auth/token')
        //         .set('Content-Type', 'application/x-www-form-urlencoded')
        //         .set('Authorization', `Basic ${process.env.TOKEN_AUTH_BEARER}`)
        //         .send({
        //             'grant_type': 'password',
        //             username: process.env.TOKEN_AUTH_USERNAME,
        //             password: process.env.TOKEN_AUTH_PASSWORD,
        //             scope: 'email phone userInfo roles'
        //         });
        // } catch (e) {
        //     /* handle error */
        //     return null;
        // }

        // return result.body.access_token;
    }

}

module.exports = new Api;
