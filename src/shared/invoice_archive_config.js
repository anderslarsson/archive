'use strict';

const moment = require('moment');
const {
    normalizeTenantId
} = require('./helpers');

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
        'doc': {
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
                    type: 'keyword' // customerId (w/o c_)
                },
                supplierId: {
                    type: 'keyword' // supplierId (w/o s_)
                },
                externalReference: {
                    properties: {
                        type: {
                            type: 'keyword'
                        },
                        value: {
                            type: 'keyword'
                        }
                    }
                },
                sender: {
                    properties: {
                        intermediator: {
                            type: 'keyword'
                        },
                        originator: {
                            type: 'keyword' // tenantId
                        },
                        protocolAttributes: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'keyword'
                                },
                                to: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256
                                        }
                                    }
                                },
                                from: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256
                                        }
                                    }
                                },
                                subject: {
                                    type: 'text'
                                }
                            }
                        }
                    }
                },
                receiver: {
                    properties: {
                        intermediator: {
                            type: 'keyword'
                        },
                        target: {
                            type: 'keyword' // tenantId
                        },
                        protocolAttributes: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'keyword'
                                },
                                to: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256
                                        }
                                    }
                                },
                                from: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256
                                        }
                                    }
                                },
                                subject: {
                                    type: 'text'
                                }
                            }
                        }
                    }
                },
                history: {
                    properties: {
                        date: {
                            type: 'date'
                        },
                        shortEventText: {
                            type: 'text'
                        },
                        eventText: {
                            type: 'text'
                        },
                        status: {
                            type: 'keyword'
                        }
                    }
                },
                document: {
                    properties: {
                        msgType: {
                            type: 'keyword'
                        },
                        msgSubType: {
                            type: 'keyword'
                        },
                        files: {
                            properties: {
                                inbound: {
                                    properties: {
                                        reference: {
                                            type: 'keyword'
                                        },
                                        refType: {
                                            type: 'keyword'
                                        },
                                    }
                                },
                                outbound: {
                                    properties: {
                                        reference: {
                                            type: 'keyword'
                                        },
                                        refType: {
                                            type: 'keyword'
                                        },
                                    }
                                },
                                canonical: {
                                    properties: {
                                        content: {
                                            type: 'text'
                                        }
                                    }
                                },
                                inboundAttachments: {
                                    properties: {
                                        reference: {
                                            type: 'keyword'
                                        },
                                        refType: {
                                            type: 'keyword'
                                        },
                                        name: {
                                            type: 'text',
                                            fields: {
                                                keyword: {
                                                    type: 'keyword',
                                                    'ignore_above': 256
                                                }
                                            }
                                        }
                                    }
                                },
                                outboundAttachments: {
                                    properties: {
                                        reference: {
                                            type: 'keyword'
                                        },
                                        refType: {
                                            type: 'keyword'
                                        },
                                        name: {
                                            type: 'text',
                                            fields: {
                                                keyword: {
                                                    type: 'keyword',
                                                    'ignore_above': 256
                                                }
                                            }
                                        }
                                    }
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
        let tId = normalizeTenantId(tenantId);
        let fmtMonth = moment().format('YYYY.MM');

        return `${this.indexPrefix}tenant_monthly-${tId}-${fmtMonth}`;
    }

    static yearlyTenantArchiveName(tenantId, date) {
        let tId = normalizeTenantId(tenantId);
        let fmtYear = moment(date).format('YYYY'); // Returns NOW when  date is undefined

        return `${this.indexPrefix}tenant_yearly-${tId}-${fmtYear}`;
    }

    static get newArchiveTransactionJobQueueName() {
        return 'archive.invoice.archiveTransactionJob.created';
    }
    static get finishedArchiveTransactionJobQueueName() {
        return 'archive.invoice.archiveTransactionJob.finished';
    }

    static get newLogrotationJobQueueName() {
        return 'archive.invoice.logrotationJob.created';
    }
    static get finishedLogrotationJobQueueName() {
        return 'archive.invoice.logrotationJob.finished';
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
