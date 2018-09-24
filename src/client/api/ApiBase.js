import request from 'superagent';
import ApiError from './ApiError';

class ApiBase {

    constructor() {
        this.ajax = request;
    }

    /**
     * Trigger open command for a specific tenant index.
     *
     * @function openArchive
     * @param {String} archiveName
     */
    openArchive(archiveName) {
        return this.ajax.post(`/archive/api/indices/${archiveName}/open`)
            .send({index: archiveName})
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getDocument(archiveName, transactionId) {
        return this.ajax.get(`/archive/api/indices/${archiveName}/documents/${transactionId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getErrorFromResponse(e) {
        if (e) {
            throw new ApiError((e.response && e.response.body && e.response.body.message) || e.body || e.message, e.response.status);
        }

        throw new Error('An unknown error occured.');
    }
}

export default ApiBase;
