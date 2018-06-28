import React from 'react';

import {
  Col,
  Grid,
  Row,
} from 'react-bootstrap';

import request from 'superagent';

import {Components} from '@opuscapita/service-base-ui';

import translations from './i18n';
import ShortTermNav from './ShortTermNav';

export default class ShortTermArchive extends Components.ContextComponent {

  constructor(props, context) {
    super(props);

    context.i18n.register('Archive', translations);

    this.handleArchiveClick = this.handleArchiveClick.bind(this);

    this.state = {
      selectedArchiveName: null,

      openingArchive: null
    };
  }

  handleArchiveClick(archiveName) {
    console.log(archiveName);

    if (archiveName) {
      this.setState({
        selectedArchiveName: archiveName,
        openingArchive: true
      });

      request
        .post('/archive/api/indices/open_request')
        .type('json')
        .send({index: archiveName})
        .then((response) => {
          if (response.body && response.body.success === true) {
            this.setState({openingArchive: false});
          } else {
            // Handle failure.
          }
        });

    }
  }

  render() {
    // const {i18n} = this.context;

    let archiveName = this.state.selectedArchiveName || 'Bitte Archiv auswählen';

    let actionState = this.state.openingArchive ? 'Opening archive ...' : 'done';

    return (
      <Grid>
        <Row>
          <Col md={2}>
            <ShortTermNav
              onHandleArchiveChange={this.handleArchiveClick}
              openingArchive={this.state.openingArchive}
            />
          </Col>

          <Col md={10}>
            <p>
              {archiveName}
            </p>
            <p>
              {actionState}
            </p>

          </Col>
        </Row>
      </Grid>
    );
  }

}

