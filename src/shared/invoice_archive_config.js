'use strict';

const moment = require('moment');
const elasticContext = require('./elasticsearch');

const MsgTypes = {
    CREATE_GLOBAL_DAILY: 'create_global_daily',
    UPDATE_TENANT_MONTHLY: 'update_tenant_monthly',
    UPDATE_TENANT_YEARLY: 'update_tenant_yearly',
    ARCHIVE_TRANSACTION: 'archive_transaction'
};

const ErrCodes = {
    ERR_INDEX_DOES_NOT_EXIST: 'ERR_INDEX_DOES_NOT_EXIST',
    ERR_SRC_INDEX_DOES_NOT_EXIST: 'ERR_SRC_INDEX_DOES_NOT_EXIST',
    ERR_INDEX_OPEN_FAILED: 'ERR_INDEX_OPEN_FAILED'
};

const esMapping = {
    mappings: {
        '_doc': {
            properties: {
                transactionId: {
                    type: 'keyword'
                },
                start: {
                    type: 'date'
                },
                end: {
                    type: 'date'
                },
                lastStatus: {
                    type: 'keyword'
                },
                customerId: {
                    type: 'keyword'
                },
                supplierId: {
                    type: 'keyword'
                },
                msgType: {
                    type: 'keyword'
                },
                msgSubType: {
                    type: 'keyword'
                },
                sender: {
                    properties: {
                        physical: {
                            type: 'keyword'
                        },
                        originator: {
                            type: 'keyword'
                        },
                        protocolAttributes: {
                            type: 'object'
                        }
                    }
                },
                receiver: {
                    properties: {
                        physical: {
                            type: 'keyword'
                        },
                        target: {
                            type: 'keyword'
                        },
                        protocolAttributes: {
                            type: 'object'
                        }
                    }
                },
                history: {
                    properties: {
                        date: {
                            type: 'date'
                        },
                        description: {
                            type: 'text'
                        },
                        status: {
                            type: 'keyword'
                        }
                    }
                },
                files: {
                    properties: {
                        inbound: {
                            properties: {
                                reference: {
                                    type: 'keyword'
                                }
                            }
                        },
                        inboundAttachments: {
                            properties: {
                                reference: {
                                    type: 'keyword'
                                },
                                name: {
                                    type: 'keyword'
                                }
                            }
                        },
                        outbound: {
                            properties: {
                                reference: {
                                    type: 'keyword'
                                }
                            }
                        },
                        outboundAttachments: {
                            properties: {
                                reference: {
                                    type: 'keyword'
                                },
                                name: {
                                    type: 'keyword'
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class InvoiceArchiveConfig {

    static get errCodes() {
        return ErrCodes;
    }

    static get msgTypes() {
        return MsgTypes;
    }

    static get indexPrefix() {
        return 'archive_invoice_';
    }

    static monthlyTenantArchiveName(tenantId) {
        let tId = elasticContext.normalizeTenantId(tenantId);
        let fmtMonth = moment().format('YYYY.MM');

        return `${this.indexPrefix}tenant_monthly-${tId}-${fmtMonth}`;
    }

    static yearlyTenantArchiveName(tenantId) {
        let tId = elasticContext.normalizeTenantId(tenantId);
        let fmtYear = moment().format('YYYY');

        return `${this.indexPrefix}tenant_yearly-${tId}-${fmtYear}`;
    }

    static get newArchiveTransactionJobQueueName() {
        return 'archive.invoice.archive.job.created';
    }
    static get finishedArchiveTransactionJobQueueName() {
        return 'archive.invoice.archive.job.finished';
    }

    static get newLogrotationJobQueueName() {
        return 'archive.invoice.logrotation.job.created';
    }
    static get finishedLogrotationJobQueueName() {
        return 'archive.invoice.logrotation.job.finished';
    }

    static get esMapping() {
        return esMapping; // TODO
    }
}

module.exports = {
    ErrCodes,
    InvoiceArchiveConfig,
    MsgTypes
};
