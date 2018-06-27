import React from 'react';
import {Components} from '@opuscapita/service-base-ui';

import translations from './i18n';
import ShortTermNav from './ShortTermNav';

export default class ShortTermArchive extends Components.ContextComponent {
  constructor(props, context) {
    super(props);
    context.i18n.register('Archive', translations);
  }

  render() {
    const {i18n} = this.context;

    return (
      <div className="container">
        <div className="row">
          <div className="col-md-2">
            <ShortTermNav />
          </div>

          <div className="col-md-10">
            Content
          </div>
        </div>
      </div>
    );
  }
}

