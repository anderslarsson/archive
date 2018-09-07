import React from 'react';
import {Components} from '@opuscapita/service-base-ui';

import {InvoiceArchiveApi} from '../api';
import translations from './i18n';

export default class InvoiceTransaction extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            index: null, // ES index name
            id: null,    // ES document ID
            doc: {
                id: null
            }
        };

        this.api = new InvoiceArchiveApi();
        context.i18n.register('Archive', translations);
    }

    fetchDocument() {
        this.api.getDocument(this.state.index, this.state.id)
            .then((data) => {
                this.setState({
                    doc: data.data
                });
            });
    }

    componentDidMount() {
        const {index, id} = this.context.router.params;

        this.setState({
            index: atob(index),
            id
        }, () => this.fetchDocument());
    }

    render() {
        const t = this.context.i18n.getMessage;

        const id = this.state.doc.id;
        const doc = this.state.doc._source;

        return (
            <div>
                <h2 className="tab-description">{t('Archive.invoice.page.title')}</h2>
                {
                    doc &&
                        <div>
                            <div className="row">
                                <div className="col-md-12 ">

                                    <table className="table">
                                        <tr>
                                            <td>Transaction ID</td>
                                            <td>{doc.transactionId}</td>
                                        </tr>
                                        <tr>
                                            <td>Start</td>
                                            <td>{doc.start}</td>
                                        </tr>
                                        <tr>
                                            <td>End</td>
                                            <td>{doc.end}</td>
                                        </tr>
                                        <tr>
                                            <td>Customer</td>
                                            <td>{doc.customerId}</td>
                                        </tr>
                                        <tr>
                                            <td>Last status</td>
                                            <td>{doc.lastStatus}</td>
                                        </tr>
                                    </table>

                                </div>
                            </div>

                            {
                                doc && doc.receiver && doc.receiver.protocolAttributes &&
                                    <div className="row">
                                        <div className="col-md-12">

                                            <h3>{t('Archive.invoice.page.headings.receiverInformation')}</h3>
                                            <table className="table">
                                                <tr>
                                                    <td>From</td>
                                                    <td>{doc.receiver.protocolAttributes.from}</td>
                                                </tr>
                                                <tr>
                                                    <td>To</td>
                                                    <td>{doc.receiver.protocolAttributes.to}</td>
                                                </tr>
                                            </table>

                                        </div>
                                    </div>
                            }

                            {
                                doc && doc.files &&  doc.files.inboundAttachments && doc.files.inboundAttachments.length > 0 &&
                                    <div className="row">
                                        <div className="col-md-12">

                                            <h3>{t('Archive.invoice.page.headings.attachments')}</h3>
                                            <table className="table">
                                                {
                                                    doc.files.inboundAttachments.map((a, i) =>
                                                        <tr key={i}>
                                                            <td>{a.name}</td>
                                                            <td>
                                                                <a href={'/blob/api/c_' + doc.customerId + '/files' + a.reference} target="_blank">Download</a>
                                                            </td>
                                                        </tr>
                                                    )
                                                }
                                            </table>

                                        </div>
                                    </div>
                            }

                            {
                                doc && doc.history && doc.history.length > 0 &&
                                    <div className="row">
                                        <div className="col-md-12">

                                            <h3>{t('Archive.invoice.page.headings.history')}</h3>
                                            <table className="table">
                                                {
                                                    doc.history.map((h, i) =>
                                                        <tr key={i}>
                                                            <td>{h.name}</td>
                                                        </tr>
                                                    )
                                                }
                                            </table>

                                        </div>
                                    </div>
                            }

                        </div>
                }
            </div>
        );
    }

}

