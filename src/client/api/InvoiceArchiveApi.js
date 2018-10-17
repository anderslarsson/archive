import ApiBase from './ApiBase';

class InvoiceArchiveApi extends ApiBase {

    constructor() {
        super();
    }

    getTenantOptions() {
        return this.ajax.get('/archive/api/tenantconfig/invoice_receiving')
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getYearOptions(tenantId) {
        return this.ajax.get(`/archive/api/indices?type=invoice&tenantId=${tenantId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    createSearch(queryParams) {
        return this.ajax.post(`/archive/api/searches?index=${queryParams.index}`)
            .send(queryParams)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getInvoiceArchiveSearch(params) {
        let scrollId = params.scrollId;

        return this.ajax.get(`/archive/api/searches/${scrollId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    deleteInvoiceArchiveSearch(params) {
        let scrollId = params.scrollId;

        if (scrollId) {
            return this.ajax.delete(`/archive/api/searches/${scrollId}`)
                .then(res => res.body)
                .catch(this.getErrorFromResponse);
        } else {
            return Promise.resolve(false); // As this is a fire and forget op it is ok to not throw
        }
    }
}

export default InvoiceArchiveApi;
