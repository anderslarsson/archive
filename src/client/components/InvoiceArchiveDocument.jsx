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
            doc: null
        };

        this.api = new InvoiceArchiveApi();
        context.i18n.register('Archive', translations);
    }

    fetchDocument() {
        this.api.getDocument(this.state.index, this.state.id)
            .then((data) => {
                this.setState({
                    doc: data
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
        const {t} = this.context.i18n.getMessage;

        return (
            <div>
                <p>{this.state.index}</p>
                <p>{this.state.id}</p>
            </div>
        );
    }

}

