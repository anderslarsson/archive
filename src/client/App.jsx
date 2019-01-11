import React from 'react';
import {Containers} from '@opuscapita/service-base-ui';
import {Route, Redirect} from 'react-router';
import Search from './components/Search.jsx';
import ArchiveDocument from './components/ArchiveDocument.jsx';

const App = () =>
    <Containers.ServiceLayout serviceName="archive">
        <Route exact path='/search' component={Search}/>
        <Route path='/viewer/:index/documents/:id' component={ArchiveDocument} />

        <Redirect from='/invoices' to='/search' />
        <Redirect from='/' to='/search' />
    </Containers.ServiceLayout>;

export default App;

