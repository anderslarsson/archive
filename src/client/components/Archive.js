import React from 'react';
// import PropTypes from 'prop-types';
import {Components} from '@opuscapita/service-base-ui';
import translations from './i18n';

import {Tab, Tabs} from 'react-bootstrap';

export default class Archive extends Components.ContextComponent {

  constructor(props, context) {
    super(props);

    context.i18n.register('Archive', translations);

    this.handleSelect = this.handleSelect.bind(this);

    this.state = {
      activeTabKey: 'shortterm'
    };
  }

  handleSelect(key) {
    console.log('Nav tab click ' + key);
    let newState = Object.assign({}, this.state);
    newState.activeTabKey = key;

    this.setState(newState);
  }

  render() {
    const {i18n} = this.context;

    return (
      <div>
        <Tabs id="archiveTabs" activeKey={this.state.activeTabKey} onSelect={this.handleSelect}>
          <Tab eventKey="shortterm" title={i18n.getMessage('Archive.nav.shortterm')}>90 days</Tab>
          <Tab eventKey="longterm" title={i18n.getMessage('Archive.nav.longterm')}>Long term</Tab>
          <Tab eventKey="settings" title={i18n.getMessage('Archive.nav.settings')}>Settings</Tab>
        </Tabs>
      </div>
    );
  }

  componentDidMount() {
    // TODO fetch tenant IDs
    // TODO fetch archive names
  }
}

