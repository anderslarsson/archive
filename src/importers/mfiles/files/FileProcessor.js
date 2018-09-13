'use strict';
const simpleParser  = require('mailparse').simpleParser;
const fs            = require('fs');

const api    = require('./Api');

class FileProcessor {

    constructor(dataDir) {
        this.dataDir = dataDir;
    }

    async parse(archiveEntries) {
        let done   = [];
        let failed = [].concat(archiveEntries.failed);

        let i      = 0;
        let total  = archiveEntries.done.length;

        for (const entry of archiveEntries.done) {
            console.log(`Parsing EML  ${i++}/${total} `);

            let eml = fs.readFileSync(`${this.dataDir}/${entry.files.inbound.pathToEml}`, 'utf8');

            let parsedMail;
            try {
                parsedMail = await simpleParser(eml);
            } catch (e) {
                parsedMail = null;

                entry._errors.stage.fileProcessing.push({
                    type: 'eml_parser_failed',
                    message: 'SimpleParser failed to parse message.',
                    exception: e
                });

                failed.push(entry);
                continue;
            }

            if (parsedMail.attachments) {
                console.log(`Uploading attachments to Blob storage ${i}/${total} `);

                let uploadResult = await this.uploadAttachments(entry, parsedMail.attachments);

                /* Push entries with failed uploads to the fail queue */
                if (uploadResult.failed.length > 0) {
                    entry._errors.stage.fileProcessing.push({
                        type: 'blob_upload_failed',
                        message: 'Failed to upload attachements',
                        data: uploadResult.failed
                    });
                    failed.push(entry);
                } else {
                    /* Map result from Blog storage to archive schema. */
                    let inboundAttachments = uploadResult.done.map((e) => {
                        return {
                            reference: e.path,
                            name: e.name
                        };
                    });

                    entry.files.inboundAttachments = entry.files.inboundAttachments.concat(inboundAttachments);

                    done.push(entry);
                }
            }
        }

        // TODO
        // - return all done
        // -handle error for failed
        return {done, failed};
    }

    async uploadAttachments(archiveEntry, attachments) {
        let done = [];
        let failed = [];

        for (const attachment of attachments) {
            if (attachment && attachment.content && attachment.content instanceof Buffer) {

                try {
                    let result = await this.uploadFile(attachment.content, archiveEntry.transactionId, `c_${archiveEntry.customerId}`, attachment.filename);
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
        return api.putChunked(`http://localhost:8080/blob/api/${tenantId}/files/private/archive_b/invoice/${transactionId}/${filename}?createMissing=true`, data);
    }

}

module.exports = FileProcessor;
