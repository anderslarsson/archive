import React from 'react';
import { Containers } from '@opuscapita/service-base-ui';
import { Route } from 'react-router';

const Index = () => (
  <div className="index">
    Hello ...
  </div>
);

const App = () => (
  <Containers.ServiceLayout serviceName="earchive">
    <Route path={"/"} component={Index}/>
  </Containers.ServiceLayout>
);

export default App;

