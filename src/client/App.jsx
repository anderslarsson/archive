import React from 'react';
import {Containers} from '@opuscapita/service-base-ui';
import {Route} from 'react-router';
import Archive from './components/Archive';

const App = () =>
  <Containers.ServiceLayout serviceName="archive">
    <Route path={'/'} component={Archive}/>
  </Containers.ServiceLayout>;

export default App;

