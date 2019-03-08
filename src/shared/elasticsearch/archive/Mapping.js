'use strict';

module.exports = {
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
                    type: 'keyword' // customerId (w/o 'c_' prefix)
                },
                supplierId: {
                    type: 'keyword' // supplierId (w/o 's_' prefix)
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
                        number: {
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
                                outbound: {
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

