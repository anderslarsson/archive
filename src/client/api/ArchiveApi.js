import ApiBase from './ApiBase';

class ArchiveApi extends ApiBase {

    constructor() {
        super();
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

    createSearch(queryParams) {
        return this.ajax.post(`/archive/api/searches?index=${queryParams.index}`)
            .send(queryParams)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    /**
     * Delete a previous scroll context.
     *
     * @function
     * @param {string} scrollId - Elasticsearch scrollId
     * @return {Promise}
     * @fulfil {object} API response body
     * @reject {Error}
     */
    deleteScrollContext(scrollId) {
        if (scrollId) {
            return this.ajax.delete(`/archive/api/searches/${scrollId}`)
                .then(res => res.body)
                .catch(this.getErrorFromResponse);
        } else {
            return Promise.resolve(false); // As this is a fire and forget op it is ok to not throw
        }
    }

    /**
     * Fetch the next result from a previously created scroll.
     *
     * @function
     * @param {string} scrollId
     * @return {Promise}
     * @fulfil {object} API response body
     * @reject {Error}
     */
    getNextScrollPage(scrollId) {
        return this.ajax.get(`/archive/api/searches/${scrollId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getTenantOptions() {
        return this.ajax.get('/archive/api/tenantconfig/all')
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getYearOptions(tenantId) {
        return this.ajax.get(`/archive/api/indices?type=all&tenantId=${tenantId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }


}

export default ArchiveApi;
