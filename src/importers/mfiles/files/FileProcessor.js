'use strict';
const simpleParser  = require('mailparse').simpleParser;
const fs            = require('fs');
const path          = require('path');
const he            = require('he');
const onDeath       = require('death');

const uuidv4 = require('uuid/v4'); // random
const mime = require('mime-types');

const api    = require('./Api');

class FileProcessor {

    constructor(dataDir) {
        this.done   = [];
        this.failed = [];

        this.dataDir = dataDir; // Directory containing the Index.xml

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

    /**
     * Iterates the entries in the archiveEntries.done list,
     * parses the EML file, extracts the attachments and
     * uploads them to blob storage.
     *
     * @async
     * @function run
     * @param {object} archiveEntries
     * @param {array}  archiveEntries.done - List of archive entries to be processed.
     * @param {array}  archiveEntries.failed - List of archive entries that failed to process in a previous stage.
     * @return {object} Struct of done and failed archive entries from this stage.
     */
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

            /** Read the archive entrie's EML file from disk */
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
                continue; // Skip to next entry
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
                continue; // Skip to next entry
            }

            /* Upload attachments */
            if (parsedMail.attachments) {
                if (dts >= 10) {
                    console.log(`Uploading attachments to Blob storage ${i}/${total} `);
                }

                let uploadResult = await this.uploadAttachments(entry, parsedMail.attachments);

                if (uploadResult.failed.length > 0) {
                    /* Push entries with failed uploads to the fail queue */
                    entry._errors.stage.fileProcessing.push({
                        type: 'blob_upload_failed',
                        message: 'Failed to upload attachements',
                        data: uploadResult.failed
                    });
                    this.failed.push(entry);
                } else {
                    /* Map result from Blob storage to archive schema. */
                    let inboundAttachments = uploadResult.done.map((e) => {
                        return {
                            reference: `/${e.tenantId}/data${e.path}`,
                            refType: 'blob',
                            name: e.name
                        };
                    });

                    entry.document.files.inboundAttachments = entry.document.files.inboundAttachments.concat(inboundAttachments);
                }
            }

            /** Set readonly flag */
            if ((((entry || {}).document || {}).files || {}).inboundAttachments && entry.document.files.inboundAttachments.length > 0) {
                await this.setReadonly(entry.document.files.inboundAttachments);
            }

            this.done.push(entry);
        }

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

    async setReadonly(attachments) {
        let done   = [];
        let failed = [];

        for (const attachment of attachments) {
            try {
                const blobPath = `/blob/api${attachment.reference}`.replace('/data/private', '/data/metadata/private');

                let result = await api.patchJson(blobPath, {
                    readOnly: true
                });

                done.push(result);
            } catch (e) {
                console.error('FileProcessor#setReadonly: Failed to set readonly flag on attachment. ', attachment.reference, e);
                failed.push(attachment);
            }
        }

        return {done, failed};
    }

    async uploadAttachments(archiveEntry, attachments) {
        let done   = [];
        let failed = [];

        for (const attachment of attachments) {
            if (attachment && attachment.content && attachment.content instanceof Buffer) {

                try {
                    let tenantId = `c_${archiveEntry.customerId}`;

                    attachment.filename = this.guessFilename(attachment);

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
    async uploadFile(data, transactionId, tenantId, filename) {
        filename = encodeURI(filename);


        let blobPath = `/blob/api/${tenantId}/data/private/archive/${transactionId}/${filename}`;

        /** Check existence of file */
        let {res} = await api.head(blobPath);
        if (res && res.statusCode && res.statusCode === 200) {
            /** File exists -> skip */
            if (res.headers['x-file-info']) {
                const fileInfo = decodeURIComponent(res.headers['x-file-info']);
                return JSON.parse(fileInfo);
            } else {
                /** This should not happen but we need to indicate an error. */
                throw new Error('Blob suggest file is already existing but did not provide file info.');
            }
        } else {
            /** File does not exist, upload */
            let  result = await api.putChunked(`${blobPath}?createMissing=true`, data);

            if (!result.path) {
                console.error('FileProcessor#uploadFile: Path missing from upload result.', result);
            }

            return result;
        }
    }

    /**
     * Create a filename for a given attachment object.
     *
     * This is needed b/c there may be files w/o filename or extension. In the first case
     * we need to generate on to be able to reference to it, in the second case we need
     * to come up with an extension b/c blob service prevents us from uploading files without.
     *
     * @function guessFilename
     * @param {object} attachment
     * @param {string} attachment.filename
     * @param {string} attachment.contentType
     * @return {string} The filename
     */
    guessFilename(attachment) {
        let filename = '';

        if (!attachment.filename || typeof attachment.filename !== 'string' || attachment.filename === '') {
            filename = uuidv4();
        } else {
            filename = attachment.filename;
        }

        const extname = path.extname(filename);
        if (!extname || typeof extname !== 'string' || extname === '') {
            let extension = attachment.contentType ? '.' + (mime.extension(attachment.contentType) || 'bin') : '.bin';
            filename = `${filename}${extension}`;
        }

        return filename;
    }

}

module.exports = FileProcessor;
