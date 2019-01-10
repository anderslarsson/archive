import ArchiveApi from './ArchiveApi';

class InvoiceArchiveApi extends ArchiveApi {

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

}

export default InvoiceArchiveApi;
