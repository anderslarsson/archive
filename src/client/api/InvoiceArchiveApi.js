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
}

export default InvoiceArchiveApi;
