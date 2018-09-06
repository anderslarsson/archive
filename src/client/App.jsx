import React from 'react';
import {Containers} from '@opuscapita/service-base-ui';
import {Route, Redirect} from 'react-router';
import InvoiceArchive from './components/InvoiceArchive.jsx';

const App = () =>
    <Containers.ServiceLayout serviceName="archive">
        <Route exact path={'/invoices'} component={InvoiceArchive}/>
        <Redirect from='/' to='invoices' />
    </Containers.ServiceLayout>;

export default App;

