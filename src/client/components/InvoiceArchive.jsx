import React from 'react';
import moment from 'moment';
import ReactTable from 'react-table';
import Select from '@opuscapita/react-select';
import {Components} from '@opuscapita/service-base-ui';

import {InvoiceArchiveApi} from '../api';
import translations from './i18n';
import 'react-table/react-table.css';
import 'react-select/dist/react-select.css';

export default class InvoiceArchive extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            loading: false,
            search: {
                docs: [],
                total: 0,
                pages: 0,
                currentPage: 0,
                currentDocs: [],
                pageSize: 20,
                scrollId: null
            },
            selectedValues: {
                tenant: null,
                year: null,
                from: null,
                to: null,
                text: null
            },
            availableOptions: {
                tenants: [],
                years: []
            },
        };

        this.api = new InvoiceArchiveApi();
        context.i18n.register('Archive', translations);
    }

    componentDidMount() {
        this.fetchTenantOptions();
    }

    fetchTenantOptions() {
        this.api.getTenantOptions()
            .then(response => {
                const {availableOptions} = this.state;
                availableOptions.tenants = response;
                this.setState({availableOptions});
            })
            .catch((err) => {
                this.context.showNotification(err.message, 'error', 10);
            });
    }

    fetchYearOptions(tenantId) {
        this.api.getYearOptions(tenantId)
            .then(response => {
                const {availableOptions} = this.state;
                availableOptions.years = response.data;
                this.setState({availableOptions});
            })
            .catch((err) => {
                this.context.showNotification(err.message, 'error', 10);
            });
    }

    getTenantSelectOptions() {
        const {availableOptions} = this.state;

        if (!availableOptions || !availableOptions.tenants) {
            return [];
        }
        return availableOptions.tenants.map(tenant => ({value: tenant, label: tenant}));
    }

    getYearSelectOptions() {
        const {availableOptions} = this.state;

        if (!availableOptions || !availableOptions.years) {
            return [];
        }
        return availableOptions.years.map(year => {
            let y = year.split('-').pop();

            return {value: year, label: y};
        });
    }

    handleTenantSelection(data) {
        const {selectedValues} = this.state;
        selectedValues.tenant = data.value;

        this.setState({selectedValues});

        this.fetchYearOptions(data.value);
    }

    handleYearSelection({value}) {
        const {selectedValues} = this.state;
        selectedValues.year = value;

        this.api.openArchive(value).
            then((data) => {
                this.setState({loading: false});

                if (!data || !data.success || data.success !== true) {
                    this.context.showNotification('Failed to open archive', 'info', 10);
                }
            });

        this.setState({loading: true, selectedValues});
    }

    handleFullTextQueryChange(event) {
        let value = event.target.value;

        const {selectedValues} = this.state;
        selectedValues.fullTextQuery = value;

        this.setState({selectedValues});
    }

    resetSearchForm(e) {
        // TODO delete scroll on ES
        e.preventDefault();

        const selectedValues = {
            tenant: null,
            year: null,
        };

        const availableOptions = {
            years: []
        };

        this.setState({selectedValues, availableOptions}, () => this.handleSearch());
    }

    handleSearch(e) {
        // TODO clear old scroll

        e && e.preventDefault();

        const {search, selectedValues} = this.state;

        if (!selectedValues.tenant || !selectedValues.year) {
            search.docs = [];
            this.setState({search});
            return;
        }

        let queryOptions = {
            index: selectedValues.year,
            query: {
                from: selectedValues.from,
                to: selectedValues.to,
                fullText: selectedValues.fullTextQuery
            },
            pageSize: search.pageSize
        };

        this.setState({loading: true});

        this.api.createSearch(queryOptions)
            .then(response => {
                let result = response.data;

                let searchUpdate = Object.assign({},this.state.search, {
                    docs: result.hits.hits,
                    currentPage: 0,
                    currentDocs: result.hits.hits,
                    total: result.hits.total,
                    pages: Math.ceil(result.hits.total / search.pageSize),
                    pageSize: search.pageSize,
                    scrollId: result.scrollId
                });

                this.setState({
                    loading: false,
                    search: searchUpdate
                });
            })
            .catch((err) => {
                this.context.showNotification(err.message, 'error', 10);
            });
    }

    render() {
        const {i18n} = this.context;
        const {loading, search, availableOptions, selectedValues} = this.state;

        return (
            <div>
                <h1 className="tab-description">{i18n.getMessage('Archive.title')}</h1>
                <div className="form-horizontal">
                    <div className="row">
                        <div className="col-md-6">
                            <div className="form-group">
                                <div className="col-md-4">
                                    <label className="control-label">
                                        {i18n.getMessage('Archive.forms.labels.tenant')}
                                    </label>
                                </div>
                                <div className="offset-md-2 col-md-6">
                                    <Select
                                        placeholder=""
                                        className="react-select"
                                        value={selectedValues.tenant}
                                        options={this.getTenantSelectOptions()}
                                        onChange={value => this.handleTenantSelection(value)}/>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-group">
                                <div className="col-md-4">
                                    <label className="control-label">
                                        {i18n.getMessage('Archive.forms.labels.years')}
                                    </label>
                                </div>
                                <div className="offset-md-2 col-md-6">
                                    <Select
                                        placeholder=""
                                        className="react-select"
                                        value={selectedValues.year}
                                        options={this.getYearSelectOptions()}
                                        onChange={value => this.handleYearSelection(value)}
                                        disabled={!availableOptions.years || !availableOptions.years.length}/>
                                </div>
                            </div>
                        </div>
                    </div>
                    {
                        selectedValues.year &&
                            <span>
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="form-group">
                                            <div className="col-md-4">
                                                <label className="control-label">
                                                    {i18n.getMessage('Archive.forms.labels.from')}
                                                </label>
                                            </div>
                                            <div className="offset-md-2 col-md-6">
                                                <Components.DatePicker
                                                    className='form-control'
                                                    showIcon={false}
                                                    onChange={(event) => {
                                                        let selectedValuesUpdate = Object.assign({}, this.state.selectedValues, {
                                                            from: event.date
                                                        });
                                                        this.setState({selectedValues: selectedValuesUpdate});
                                                    }}
                                                    value={this.state.selectedValues.from}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-group">
                                            <div className="col-md-4">
                                                <label className="control-label">
                                                    {i18n.getMessage('Archive.forms.labels.to')}
                                                </label>
                                            </div>
                                            <div className="offset-md-2 col-md-6">
                                                <Components.DatePicker
                                                    className='form-control'
                                                    showIcon={false}
                                                    onChange={(event) => {
                                                        let selectedValuesUpdate = Object.assign({}, this.state.selectedValues, {
                                                            to: event.date
                                                        });
                                                        this.setState({selectedValues: selectedValuesUpdate});
                                                    }}
                                                    value={this.state.selectedValues.to}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-12">
                                        <div className="form-group">
                                            <div className="col-md-2">
                                                <label className="control-label">
                                                    {i18n.getMessage('Archive.forms.labels.textSearch')}
                                                </label>
                                            </div>
                                            <div className="offset-md-1 col-md-9">
                                                <input type="text" value={this.state.fullTextQuery} onChange={value => this.handleFullTextQueryChange(value)} className="form-control" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </span>
                    }
                </div>
                <div className="form-submit text-right">
                    <button className="btn btn-link" onClick={e => this.resetSearchForm(e)}>
                        {i18n.getMessage('Archive.forms.buttons.reset')}
                    </button>
                    <button className="btn btn-primary" onClick={e => this.handleSearch(e)}>
                        {i18n.getMessage('Archive.forms.buttons.search')}
                    </button>
                </div>
                <hr/>
                <ReactTable className="user-list-table"
                    data={search.currentDocs}

                    loading={loading}

                    manual
                    pages={search.pages}
                    defaultPageSize={20}
                    showPageSizeOptions={false}
                    showPageJump={false}

                    onFetchData={(state) => {
                        if (this.state.search.docs.length <= 0) {
                            return;
                        }

                        let isBackNav = state.page < this.state.search.currentPage;
                        let alreadyFetched = (state.page * this.state.search.pageSize) < this.state.search.docs.length;

                        if (isBackNav || alreadyFetched) {
                            let currentDocs = this.state.search.docs.slice(state.page * this.state.search.pageSize, (state.page + 1) * this.state.search.pageSize);
                            let searchUpdate = Object.assign({}, this.state.search, {
                                currentPage: state.page,
                                currentDocs
                            });
                            this.setState({search: searchUpdate});
                        } else {
                            /* Forware navigation. Fetch next result from ES */
                            this.api.getInvoiceArchiveSearch(this.state.search)
                                .then((res) => {
                                    let hits = res.data.hits.hits;

                                    let searchUpdate = Object.assign({}, this.state.search, {
                                        currentPage: state.page,
                                        docs: this.state.search.docs.concat(hits),
                                        currentDocs: hits
                                    });

                                    this.setState({search: searchUpdate});
                                });
                        }
                    }}

                    defaultSorted={[{id: 'transactionId', desc: false}]}

                    loadingText={i18n.getMessage('Archive.table.loading')}
                    noDataText={i18n.getMessage('Archive.table.empty')}
                    previousText={i18n.getMessage('Archive.table.pagination.previous')}
                    nextText={i18n.getMessage('Archive.table.pagination.next')}
                    pageText={i18n.getMessage('Archive.table.pagination.page')}
                    ofText={i18n.getMessage('Archive.table.pagination.of')}
                    rowsText={i18n.getMessage('Archive.table.pagination.rows')}

                    columns={[
                        {
                            accessor: '_source.transactionId',
                            Header: i18n.getMessage('Archive.table.columns.id.title')
                        },
                        {
                            id: 'startDate',
                            accessor: doc => moment(doc._source.start).format('YYYY-MM-DD'),
                            Header: i18n.getMessage('Archive.table.columns.startDate.title')
                        },
                        {
                            id: 'endDate',
                            accessor: doc => moment(doc._source.end).format('YYYY-MM-DD'),
                            Header: i18n.getMessage('Archive.table.columns.endDate.title')
                        }
                    ]}
                />

            </div>
        );
    }
}

