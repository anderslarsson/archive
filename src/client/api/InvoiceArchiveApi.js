import ApiBase from './ApiBase';

class InvoiceArchiveApi extends ApiBase {

    getTenantOptions() {
        return this.ajax.get('/archive/api/tenantconfig/invoice_receiving').then(res => res.body).catch(this.getErrorFromResponse);
    }

    getYearOptions(tenantId) {
        return this.ajax.get(`/archive/api/indices/invoice/${tenantId}`).then(res => res.body).catch(this.getErrorFromResponse);
    }

    queryInvoiceArchive(queryParams) {
        // TODO query table data with selectedValues...
        return this.ajax.post('/dummy-elastic/query').send(queryParams).then(res => res.body).catch(this.getErrorFromResponse);
    }
}

export default InvoiceArchiveApi;
