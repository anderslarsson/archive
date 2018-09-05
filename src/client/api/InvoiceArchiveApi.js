import ApiBase from './ApiBase';

class InvoiceArchiveApi extends ApiBase {

    constructor() {
        super();
    }

    getTenantOptions() {
        return this.ajax.get('/archive/api/tenantconfig/invoice_receiving').then(res => res.body).catch(this.getErrorFromResponse);
    }

    getYearOptions(tenantId) {
        return this.ajax.get(`/archive/api/indices/invoice/${tenantId}`).then(res => res.body).catch(this.getErrorFromResponse);
    }

    queryInvoiceArchive(queryParams) {
        return this.ajax.post('/archive/api/archive/invoice/searches')
            .send(queryParams)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }

    getInvoiceArchiveSearch(params) {
        let scrollId = params.scrollId;

        return this.ajax.get(`/archive/api/archive/invoice/searches/${scrollId}`)
            .then(res => res.body)
            .catch(this.getErrorFromResponse);
    }
}

export default InvoiceArchiveApi;
