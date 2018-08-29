import ApiBase from './ApiBase';

class Elastic extends ApiBase {

    getTenantOptions() {
        // TODO fetch tenant IDs
        return this.ajax.get('/archive/api/tenantconfig/invoice_receiving').then(res => res.body).catch(this.getErrorFromResponse);
    }

    getYearOptions(tenantId) {
        // TODO fetch archive years of tenant
        return this.ajax.get(`/dummy-elastic/${tenantId}/years`).then(res => res.body).catch(this.getErrorFromResponse);
    }

    queryInvoiceArchive(queryParams) {
        // TODO query table data with selectedValues...
        return this.ajax.post('/dummy-elastic/query').send(queryParams).then(res => res.body).catch(this.getErrorFromResponse);
    }
}

export default Elastic;
