import React from 'react';
import request from 'superagent';

import {Components} from '@opuscapita/service-base-ui';
import translations from './i18n';

import {
  Col,
  ControlLabel,
  FormControl,
  FormGroup,
  ListGroup,
  ListGroupItem,
  Row,
} from 'react-bootstrap';

export default class ShortTermNav extends Components.ContextComponent {
  constructor(props, context) {
    super(props);
    context.i18n.register('Archive', translations);

    this.handleTenantIdSelectChange = this.handleTenantIdSelectChange.bind(this);
    this.handleArchiveOnClick = this.handleArchiveOnClick.bind(this);

    this.state = {
      indices: [],
      tenantIndices: [],
      selectedTenantId: null
    };
  }

  handleArchiveOnClick(e) {
    console.log(e);
  }

  handleTenantIdSelectChange(e) {
    let selectedTenantId = e.target.value;

    let tenantIndices = this.state.indices.filter((t) => t.tenant === selectedTenantId)[0].indices;

    this.setState({
      selectedTenantId: selectedTenantId,
      tenantIndices: tenantIndices
    });
  }

  render() {
    const {i18n} = this.context;

    let tenantOptions = this.state.indices.map((t) =>
      <option key={t.tenant.toString()} value={t.tenant.toString()}>{t.tenant}</option>
    );

    if (tenantOptions.length > 0) {
      tenantOptions.unshift(<option key="noop" selected disabled>Please select a tenant ID ...</option>);
    } else {
      tenantOptions.unshift(<option key="noop" selected disabled>No tenants with archiving enabled.</option>);
    }

    let availableArchives = this.state.tenantIndices.map((archiveName) => {
      let displayName = archiveName.split(this.state.selectedTenantId.toLowerCase() + '-').pop();

      return (
        <ListGroupItem
          key={archiveName}
          onClick={this.handleArchiveOnClick}
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
                  placeholder={i18n.getMessage('Archive.forms.selectTenantIdPlaceholder')}
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

  componentDidMount() {
    request
      .get('/archive/api/indices/monthly')
      .then((res) => {
        this.setState({indices: res.body});
      }).
      catch(() => {
        this.setState({indices: []});
      });
  }
}
