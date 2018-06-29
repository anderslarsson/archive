'use strict';

import {
  Col,
  ControlLabel,
  Form,
  FormControl,
  FormGroup,
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
    this.handleArchiveChange = this.handleArchiveChange.bind(this);

    this.state = {
      indices: [],
      tenantIndices: [],
      selectedTenantId: 'noop',
      selectedArchive: 'noop'
    };
  }

  buildAvailableArchivesOptions() {
    const t = this.context.i18n.getMessage;

    let availableArchives = this.state.tenantIndices.map((archiveName) => {
      let displayName = archiveName.split(this.state.selectedTenantId.toLowerCase() + '-').pop();

      return (
        <option
          key={archiveName}
          value={archiveName}
        >
          {displayName}
        </option>
      );
    });

    if (availableArchives.length > 0) {
      availableArchives.unshift(<option key="noop" disabled>{t('Archive.forms.tenantIndexSelect.archiveSelect')}</option>);
    } else {
      availableArchives.unshift(<option key="noop" disabled>{t('Archive.forms.tenantIndexSelect.archiveSelectEmpty')}</option>);
    }

    return availableArchives;
  }

  buildTenantOptions() {
    const t = this.context.i18n.getMessage;

    let tenantOptions = this.state.indices.map((i) =>
      <option
        key={i.tenant.toString()}
        value={i.tenant.toString()}
      >{i.tenant}</option>
    );

    if (tenantOptions.length > 0) {
      tenantOptions.unshift(<option key="noop" disabled>{t('Archive.forms.tenantIndexSelect.tenantIdSelect')}</option>);
    } else {
      tenantOptions.unshift(<option key="noop" disabled>{t('Archive.forms.tenantIndexSelect.tenantIdSelectEmpty')}</option>);
    }

    return tenantOptions;
  }

  handleArchiveChange(e) {
    let selectedArchive = e.target.value;

    this.setState({selectedArchive: selectedArchive});

    this.props.onHandleArchiveChange(e.target.value);
  }

  handleTenantIdSelectChange(e) {
    let selectedTenantId = e.target.value;

    let tenantIndices = this.state.indices
      .filter((t) => t.tenant === selectedTenantId)[0].indices;

    this.setState({
      selectedTenantId: selectedTenantId,
      selectedArchive: 'noop',
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
    const t = this.context.i18n.getMessage;

    let availableArchives = this.buildAvailableArchivesOptions();
    let tenantOptions = this.buildTenantOptions();

    return (
      <Row>
        <Col md={12}>

          <Form inline>

            <FormGroup controlId="formInlineTenant">
              <ControlLabel>{t('Archive.forms.tenantIndexSelect.selectTenantId')}</ControlLabel>{': '}
              <FormControl
                componentClass="select"
                onChange={this.handleTenantIdSelectChange}
                value={this.state.selectedTenantId}
              >
                {tenantOptions}
              </FormControl>
            </FormGroup>{'  '}

            <FormGroup controlId="formInlineArchive">
              <ControlLabel>{t('Archive.forms.tenantIndexSelect.selectArchive')}</ControlLabel>{': '}
              <FormControl
                componentClass="select"
                onChange={this.handleArchiveChange}
                value={this.state.selectedArchive}
              >
                {availableArchives}
              </FormControl>
            </FormGroup>

          </Form>

        </Col>
      </Row>
    );
  }
}
