import React from 'react';
import {Components} from '@opuscapita/service-base-ui';

import {InvoiceArchiveApi} from '../api';
import translations from './i18n';

export default class InvoiceTransaction extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            indexName: null,
            transactionId: null,
            doc: null
        };

        this.api = new InvoiceArchiveApi();
        context.i18n.register('Archive', translations);
    }

    componentDidMount() {
        // TODO fetch transaction
        const {indexName, id} = this.context.router.params;
        this.setState({
            indexName: atob(indexName),
            transactionId: id
        });
    }

    render() {
        const {t} = this.context.i18n.getMessage;

        return (
            <div>
                <p>{this.state.indexName}</p>
                <p>{this.state.transactionId}</p>
            </div>
        );
    }

}

