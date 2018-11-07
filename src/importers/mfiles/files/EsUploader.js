'use strict';

const fs  = require('fs');
const onDeath = require('death');
const api = require('./Api');

module.exports = class EsUploader {

    constructor(shouldUpdate = false) {
        this.done   = [];
        this.failed = [];

        this.shouldUpdate = shouldUpdate;

        this.disposeDeath = onDeath(() => {
            let d = Date.now();

            fs.writeFileSync(`./${d}_persistToEs.json`, JSON.stringify({done: this.done, failed: this.failed}, null, 4), (err) => {
                if (err) {
                    console.error(err);
                    return;
                };
            });
        });

    }

    dispose() {
        this.disposeDeath();
    }

    async run(archiveEntries) {
        this.done = [];
        this.failed = [].concat(archiveEntries.failed);

        let timeLast = Date.now();
        let i = 0;
        for (const entry of archiveEntries.done) {
            const dts = Math.ceil((Date.now() - timeLast) / 1000);
            i++;

            if (dts >= 10) {
                console.log(`Creating ES document ${i}/${archiveEntries.done.length} `);
                timeLast = Date.now();
            }

            /* Remove uneccessary data before writing to ES */
            let cleanedEntry = Object.assign({}, entry);
            if (cleanedEntry._errors) {
                delete cleanedEntry._errors;
            }

            try {
                const updateParam = this.shouldUpdate ? '?update=true' : '';

                let result = await api.postJson(`/archive/api/archive/invoices${updateParam}`, cleanedEntry);

                if (result && result.success === true) {
                    this.done.push(entry);
                } else {
                    entry._errors.stage.persistToEs.push({
                        message: result.error || 'API error without message.',
                        data: result
                    });
                    this.failed.push(entry);
                    console.error('Failed to persist to ES');
                }
            } catch (e) {
                entry._errors.stage.persistToEs.push({
                    message: 'Failed to persist to ES with exception',
                    data: e
                });
                this.failed.push(entry);
                console.error('Failed to persist to ES with exception: ', e, entry);
            }
        }

        return {
            done: this.done,
            failed: this.failed
        };
    }

};
