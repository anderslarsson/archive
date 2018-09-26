'use strict';
const simpleParser  = require('mailparse').simpleParser;
const fs            = require('fs');
const path          = require('path');
const he            = require('he');
const onDeath       = require('death');

const api    = require('./Api');

class FileProcessor {

    constructor(dataDir) {
        this.done = [];
        this.failed = [];

        this.dataDir = dataDir;

        this.disposeDeath = onDeath(() => {
            let d = Date.now();

            fs.writeFileSync(`./${d}_fileProcessing.json`, JSON.stringify({done: this.done, failed: this.failed}, null, 4), (err) => {
                if (err) {
                    console.error(err);
                    return;
                };
            });

            process.exit();
        });
    }

    dispose() {
        this.disposeDeath();
    }

    async run(archiveEntries) {
        this.done   = [];
        this.failed = [].concat(archiveEntries.failed);

        let i      = 0;
        let total  = archiveEntries.done.length;

        let timeLast = Date.now();

        for (const entry of archiveEntries.done) {

            i++;
            const dts = Math.ceil((Date.now() - timeLast) / 1000);

            if (dts >= 10) {
                console.log(`Parsing EML  ${i}/${total} `);
                timeLast = Date.now();
            }

            let eml = null;
            try {
                eml = this.readEml(entry);
            } catch (e) {
                if (e.data) {
                    console.error(`FileProcessor#readEml: ${e.data.message}`, e);
                    entry._errors.stage.fileProcessing.push(e.data);

                } else {
                    let msg = 'FileProcessor#parse: Unhandled exception in #readEml()';
                    console.error(msg, e);
                    entry._errors.stage.fileProcessing.push({
                        exception: e
                    });
                }

                this.failed.push(entry);
                continue;
            }

            /* Parse EML file */
            let parsedMail;
            try {
                parsedMail = await simpleParser(eml);
            } catch (e) {
                console.error('FileProcessor#parse: Failed to parse EML.', e);
                parsedMail = null;

                entry._errors.stage.fileProcessing.push({
                    type: 'eml_parser_failed',
                    message: 'SimpleParser failed to parse message.',
                    exception: e
                });

                this.failed.push(entry);
                continue;
            }

            /* Upload attachments */
            if (parsedMail.attachments) {
                if (dts >= 10) {
                    console.log(`Uploading attachments to Blob storage ${i}/${total} `);
                }

                let uploadResult = await this.uploadAttachments(entry, parsedMail.attachments);

                /* Push entries with failed uploads to the fail queue */
                if (uploadResult.failed.length > 0) {
                    entry._errors.stage.fileProcessing.push({
                        type: 'blob_upload_failed',
                        message: 'Failed to upload attachements',
                        data: uploadResult.failed
                    });
                    this.failed.push(entry);
                } else {
                    /* Map result from Blog storage to archive schema. */
                    let outboundAttachments = uploadResult.done.map((e) => {
                        return {
                            reference: `/${e.tenantId}/data${e.path}`,
                            refType: 'blob',
                            name: e.name
                        };
                    });

                    entry.document.files.outboundAttachments = entry.document.files.outboundAttachments.concat(outboundAttachments);

                    this.done.push(entry);
                }
            }
        }

        // TODO
        // - return all done
        // -handle error for failed
        return {
            done: this.done,
            failed: this.failed
        };
    }

    /**
     * Takes a single archive entry as input
     * and tries to read the EML file it
     * references.
     *
     * @param {object} entry
     */
    readEml(entry) {
        const pathToEml = ((((entry || {}).document || {}).files || {}).inbound || {}).pathToEml || false;
        if (pathToEml === false) {
            let msg = 'Unable to access pathToEml property.';
            let error = new Error(msg);
            error.data = {
                type: 'read_pathtoeml_prop_failed',
                message: msg
            };
            throw error;
        }

        let fileName;
        try {
            fileName = he.decode(entry.document.files.inbound.pathToEml);
        } catch (e) {
            let msg = 'Unable decode path with he.';
            let error = new Error(msg);
            error.data = {
                type: 'decode_pathtoeml_prop_failed',
                message: msg,
                exception: e
            };
            throw error;
        }

        let eml;
        let readFailed = false;
        try {
            eml = fs.readFileSync(`${this.dataDir}/${fileName}`, 'utf8');
        } catch (e) {
            readFailed = true;
        }

        /* Retry with fallback to read file in the given directory in /L/L */
        try {
            if (readFailed) {
                const dirname = path.dirname(`${this.dataDir}/${fileName}`);
                const ls = fs.readdirSync(dirname);

                if (ls && ls.length >= 1) {
                    let fallbackFileName = ls.find((e) => e.toLowerCase().endsWith('.eml'));

                    if (fallbackFileName) {
                        eml = fs.readFileSync(`${dirname}/${fallbackFileName}`, 'utf8');
                    } else {
                        throw new Error('No EML in directory ' + dirname + ' and filename ' + fallbackFileName);
                    }
                }
            }
        } catch (e) {
            let msg = 'Failed to read EML file';
            let error = new Error(msg);
            error.data = {
                type: 'read_file_failed',
                message: msg,
                exception: e
            };

            throw error;
        }

        if (!eml || eml === '') {
            let msg = 'Failed to read EML file or file is empty.';
            let error = new Error(msg);
            error.data = {
                type: 'read_file_failed_or_empty',
                message: msg
            };

            throw error;
        }

        return eml;
    }

    async uploadAttachments(archiveEntry, attachments) {
        let done = [];
        let failed = [];

        for (const attachment of attachments) {
            if (attachment && attachment.content && attachment.content instanceof Buffer) {

                try {
                    let tenantId = `c_${archiveEntry.customerId}`;
                    let result = await this.uploadFile(attachment.content, archiveEntry.transactionId, tenantId, attachment.filename);
                    result.tenantId = tenantId;
                    done.push(result);
                } catch (e) {
                    console.error('FileProcessor#uploadAttachments: Failed to upload attachment. ', e);
                    failed.push(attachment);
                }

            }
        }

        return {done, failed};
    }

    /**
     * Uploads a single file by calling the Blob API
     *
     * @function
     * @param {Object} data
     * @param {String} transactionId
     * @param {String} tenantId
     * @param {filename}
     * @return {Promise <Obkect>}
     */
    uploadFile(data, transactionId, tenantId, filename) {
        filename = encodeURI(filename);
        return api.putChunked(`/blob/api/${tenantId}/data/private/archive/${transactionId}/${filename}?createMissing=true`, data);
    }

}

module.exports = FileProcessor;
