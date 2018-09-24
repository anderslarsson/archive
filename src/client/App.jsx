import React from 'react';
import {Containers} from '@opuscapita/service-base-ui';
import {Route, Redirect} from 'react-router';
import InvoiceArchive from './components/InvoiceArchive.jsx';
import InvoiceArchiveDocument from './components/InvoiceArchiveDocument.jsx';

const App = () =>
    <Containers.ServiceLayout serviceName="archive">
        <Route exact path='/invoices' component={InvoiceArchive}/>
        <Route path='/invoices/:index/documents/:id' component={InvoiceArchiveDocument} />

        <Redirect from='/' to='invoices' />
    </Containers.ServiceLayout>;

export default App;

