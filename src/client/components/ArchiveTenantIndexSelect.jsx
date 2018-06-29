'use strict';

import {
  Col,
  ControlLabel,
  FormControl,
  FormGroup,
  ListGroup,
  ListGroupItem,
  Row,
} from 'react-bootstrap';

import React from 'react';
import request from 'superagent';

import {Components} from '@opuscapita/service-base-ui';
import translations from './i18n';

export default class ArchiveTenantIndexSelect extends Components.ContextComponent {

  constructor(props, context) {
    super(props);

    context.i18n.register('Archive', translations);

    this.handleTenantIdSelectChange = this.handleTenantIdSelectChange.bind(this);
    this.handleArchiveOnClick = this.handleArchiveOnClick.bind(this);

    this.state = {
      indices: [],
      tenantIndices: [],
      selectedTenantId: 'noop'
    };
  }

  handleArchiveOnClick(e) {
    this.props.onHandleArchiveChange(e.target.value);
  }

  handleTenantIdSelectChange(e) {
    let selectedTenantId = e.target.value;

    let tenantIndices = this.state.indices
      .filter((t) => t.tenant === selectedTenantId)[0].indices;

    this.setState({
      selectedTenantId: selectedTenantId,
      tenantIndices: tenantIndices
    });
  }

  componentDidMount() {
    request
      .get(`/archive/api/indices/${this.props.mode}`)
      .then((res) => {
        this.setState({indices: res.body});
      }).
      catch(() => {
        this.setState({indices: []});
      });
  }

  render() {
    const {i18n} = this.context;

    let tenantOptions = this.state.indices.map((t) =>
      <option key={t.tenant.toString()} value={t.tenant.toString()}>{t.tenant}</option>
    );

    if (tenantOptions.length > 0) {
      tenantOptions.unshift(<option key="noop" disabled>Please select a tenant ID ...</option>);
    } else {
      tenantOptions.unshift(<option key="noop" disabled>No tenants with archiving enabled.</option>);
    }

    let availableArchives = this.state.tenantIndices.map((archiveName) => {
      let displayName = archiveName.split(this.state.selectedTenantId.toLowerCase() + '-').pop();

      return (
        <ListGroupItem
          key={archiveName}
          onClick={this.handleArchiveOnClick}
          value={archiveName}
        >
          {displayName}
        </ListGroupItem>
      );
    });

    return (
      <div>
        <Row>
          <Col md={12}>
            <form>
              <FormGroup controlId="formControlsSelect">
                <ControlLabel>{i18n.getMessage('Archive.forms.selectTenantId')}</ControlLabel>
                <FormControl
                  componentClass="select"
                  onChange={this.handleTenantIdSelectChange}
                  value={this.state.selectedTenantId}
                >
                  {tenantOptions}
                </FormControl>
              </FormGroup>
            </form>
          </Col>
        </Row>

        <Row>
          <Col md={12}>
            <div>
              <ListGroup>
                {availableArchives}
              </ListGroup>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
