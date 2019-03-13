import React from 'react';
import {Components} from '@opuscapita/service-base-ui';

import {ArchiveApi} from '../api';
import translations from './i18n';

export default class ArchiveDocument extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            loaded: false,
            index: null, // ES index name
            id: null,    // ES document ID
            doc: {
                id: null
            }
        };

        if (props.data) {
            this.state.loaded = true;
            this.state.showedInModal = props.showedInModal || false;
            this.state.doc._source = props.data.doc;
            this.state.doc.id = props.data.id;
        }

        this.api = new ArchiveApi();
        context.i18n.register('Archive', translations);
    }

    fetchDocument() {
        this.api.getDocument(this.state.index, this.state.id)
            .then((data) => {
                this.setState({
                    loaded: true,
                    doc: data.data
                });
            });
    }

    componentDidMount() {
        if (!this.state.loaded) {
            const {index, id} = this.context.router.params;

            this.setState({
                index: atob(index),
                id
            }, () => this.fetchDocument());
        }
    }

    render() {
        const t = this.context.i18n.getMessage;

        const doc = this.state.doc._source;

        return (
            <div>
                {
                    !this.state.showedInModal &&
                        <h2 className="tab-description">{t('Archive.invoice.page.title')}</h2>
                }
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
                                        {
                                            doc.document && doc.document.number &&
                                                <tr>
                                                    <td>{t('Archive.invoice.page.labels.documentNumber')}</td>
                                                    <td>{doc.document.number}</td>
                                                </tr>
                                        }
                                        <tr>
                                            <td>{t('Archive.invoice.page.labels.startDate')}</td>
                                            <td>{doc.start}</td>
                                        </tr>
                                        <tr>
                                            <td>{t('Archive.invoice.page.labels.endDate')}</td>
                                            <td>{doc.end}</td>
                                        </tr>
                                        <tr>
                                            <td>{t('Archive.invoice.page.labels.customerId')}</td>
                                            <td>{doc.customerId}</td>
                                        </tr>
                                        <tr>
                                            <td>{t('Archive.invoice.page.labels.lastStatus')}</td>
                                            <td>{doc.lastStatus}</td>
                                        </tr>

                                        {
                                            doc.document && doc.document.amount &&
                                                <tr>
                                                    <td>{t('Archive.invoice.page.labels.totalAmount')}</td>
                                                    <td>{doc.document.amount}</td>
                                                </tr>
                                        }

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
                                                    <td>{t('Archive.invoice.page.labels.from')}</td>
                                                    <td>{doc.receiver.protocolAttributes.from}</td>
                                                </tr>
                                                <tr>
                                                    <td>{t('Archive.invoice.page.labels.to')}</td>
                                                    <td>{doc.receiver.protocolAttributes.to}</td>
                                                </tr>
                                                <tr>
                                                    <td>{t('Archive.invoice.page.labels.emailSubject')}</td>
                                                    <td>{doc.receiver.protocolAttributes.subject}</td>
                                                </tr>
                                            </table>

                                        </div>
                                    </div>
                            }

                            {
                                doc && doc.document && doc.document.files &&  doc.document.files.inboundAttachments && doc.document.files.inboundAttachments.length > 0 &&
                                    <div className="row">
                                        <div className="col-md-12">

                                            <h3>{t('Archive.invoice.page.headings.attachments')}</h3>
                                            <table className="table">
                                                {
                                                    doc.document.files.inboundAttachments.map((a, i) =>
                                                        <tr key={i}>
                                                            <td>{a.name}</td>
                                                            <td>
                                                                <a href={'/blob/api' + this._encodeFileName(a.reference)} target="_blank" rel="noopener noreferrer">Download</a>
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
                                                        <tbody key={i}>
                                                            <tr>
                                                                <td>{h.date}</td>
                                                                <td>{h.shortEventText}</td>
                                                                <td>{h.status}</td>
                                                            </tr>
                                                        </tbody>
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

    /**
     * URI encode the filename of a given blob reference.
     *
     * @param {string} reference - Path to a file on blob storage
     * @return {string} Encoded path
     */
    _encodeFileName(reference) {
        let pathComponents = reference.split('/');
        const encFilename = encodeURIComponent(pathComponents.pop());
        const path = `${pathComponents.join('/')}/${encFilename}`;

        return path;
    }

}

