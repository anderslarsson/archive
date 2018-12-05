import React from 'react';
import {format} from 'date-fns';
import ReactTable from 'react-table';
import Select from '@opuscapita/react-select';
import {Components} from '@opuscapita/service-base-ui';

import {InvoiceArchiveApi} from '../api';
import InvoiceArchiveDocument from './InvoiceArchiveDocument.jsx';
import translations from './i18n';

import 'react-table/react-table.css';
import 'react-select/dist/react-select.css';

export default class InvoiceArchive extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            loading: false,
            showModal: false,
            selectedDoc: {
                id: null,
                doc: null
            },
            search: {
                docs: [],
                total: 0,
                pages: 0,
                currentPage: 0,
                currentDocs: [],
                pageSize: 20,
                scrollId: null,
                sortBy: 'start',
                sortOrder: 'asc'
            },
            selectedValues: {
                tenant: null,
                index: null,
                from: null,
                to: null,
                text: null
            },
            availableOptions: {
                tenants: [],
                indices: []
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
                if (response && response.data && response.data.length === 0) {
                    this.context.showNotification('No archived data found.', 'error', 10);
                } else {
                    const {availableOptions} = this.state;
                    availableOptions.indices = response.data;
                    this.setState({availableOptions});
                }
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
        return availableOptions.tenants.map(tenant => ({value: tenant.id, label: tenant.name}));
    }

    getYearSelectOptions() {
        const {availableOptions} = this.state;

        if (!availableOptions || !availableOptions.indices) {
            return [];
        }
        return availableOptions.indices.map(index => {
            let y = index.split('-').pop();

            return {value: index, label: y};
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
        selectedValues.index = value;

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
        this.api.deleteInvoiceArchiveSearch(this.state.search); // Fire and forget

        e.preventDefault();

        this.setState({
            loading: false,
            showModal: false,
            selectedDoc: {
                id: null,
                doc: null
            },
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
                index: null,
                from: null,
                to: null,
                text: null
            },
            availableOptions: {
                tenants: [],
                indices: []
            },
        }, () => this.fetchTenantOptions());
    }

    handleSearch(e) {
        if (this.state.search.scrollId) {
            this.api.deleteInvoiceArchiveSearch(this.state.search); // Fire and forget
        }

        e && e.preventDefault();

        const {search, selectedValues} = this.state;

        if (!selectedValues.tenant || !selectedValues.index) {
            search.docs = [];
            this.setState({search});
            return;
        }

        let queryOptions = {
            index: selectedValues.index,
            sort: {
                field: this.state.search.sortBy,
                order: this.state.search.sortOrder
            },
            query: {
                year: selectedValues.index.split('-').pop(),
                from: selectedValues.from && format(selectedValues.from, 'YYYY-MM-DD'),
                to: selectedValues.to && format(selectedValues.to, 'YYYY-MM-DD'),
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

    scrollSearch(state) {
        if (this.state.search.docs.length <= 0) {
            return; // !!!
        }

        let sortOrder = 'asc';

        let sortChanged = false;
        if (state && state.sorted && state.sorted[0]) {
            sortOrder = state.sorted[0].desc ? 'desc' : 'asc';
            sortChanged = this.state.search.sortBy !== state.sorted[0].id || this.state.search.sortOrder !== sortOrder;
        }

        if (sortChanged) {
            const searchUpdate = Object.assign({}, this.state.search, {
                sortBy: state.sorted[0].id,
                sortOrder: sortOrder
            });

            this.setState({search: searchUpdate}, () => this.handleSearch());
            return; // !!!
        } else {
            const isBackNav = state.page < this.state.search.currentPage;
            const alreadyFetched = (state.page * this.state.search.pageSize) < this.state.search.docs.length;

            if (isBackNav || alreadyFetched) {
                let currentDocs = this.state.search.docs.slice(state.page * this.state.search.pageSize, (state.page + 1) * this.state.search.pageSize);
                let searchUpdate = Object.assign({}, this.state.search, {
                    currentPage: state.page,
                    currentDocs
                });
                this.setState({search: searchUpdate});
            } else {
                /* Forward navigation. Fetch next result from ES */
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
        }
    }

    render() {
        const {i18n} = this.context;
        const t = this.context.i18n.getMessage;
        const {loading, search, availableOptions, selectedValues} = this.state;

        return (
            <div>
                {
                    this.state.showModal &&
                        <Components.ModalDialog
                            visible={true}
                            title={t('Archive.invoice.page.title')}
                            buttons={{'ok': 'OK'}}
                            onButtonClick={() => this.setState({showModal: false})}
                        >
                            <InvoiceArchiveDocument
                                showedInModal={true}
                                data={this.state.selectedDoc}
                            />
                        </Components.ModalDialog>
                }

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
                                        {i18n.getMessage('Archive.forms.labels.indices')}
                                    </label>
                                </div>
                                <div className="offset-md-2 col-md-6">
                                    <Select
                                        placeholder=""
                                        className="react-select"
                                        value={selectedValues.index}
                                        options={this.getYearSelectOptions()}
                                        onChange={value => this.handleYearSelection(value)}
                                        disabled={!availableOptions.indices || !availableOptions.indices.length}/>
                                </div>
                            </div>
                        </div>
                    </div>
                    {
                        selectedValues.index &&
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
                    multiSort={false}
                    pages={search.pages}
                    defaultPageSize={20}
                    showPageSizeOptions={false}
                    showPageJump={false}

                    onFetchData={(state) => this.scrollSearch(state) }

                    defaultSorted={[{id: 'transactionId', desc: false}]}

                    loadingText={i18n.getMessage('Archive.table.loading')}
                    noDataText={i18n.getMessage('Archive.table.empty')}
                    previousText={i18n.getMessage('Archive.table.pagination.previous')}
                    nextText={i18n.getMessage('Archive.table.pagination.next')}
                    pageText={i18n.getMessage('Archive.table.pagination.page')}
                    ofText={i18n.getMessage('Archive.table.pagination.of')}
                    rowsText={i18n.getMessage('Archive.table.pagination.rows')}

                    getTdProps={(state, rowInfo) => {
                        return {
                            onClick: (e, handleOriginal) => {
                                this.setState({showModal: false}, () => {
                                    let stateUpdate = Object.assign(this.state, {showModal: true}, {
                                        selectedDoc: {
                                            id: rowInfo.original._id,
                                            doc: rowInfo.original._source
                                        }
                                    });

                                    this.setState(stateUpdate);
                                });

                                if (handleOriginal) {
                                    handleOriginal();
                                }
                            }
                        };
                    }}

                    columns={[
                        {
                            id: 'transactionId',
                            accessor: '_source.transactionId',
                            Header: i18n.getMessage('Archive.table.columns.id.title'),
                            Cell: (row) => {
                                let indexName = btoa(this.state.selectedValues.index);
                                return (
                                    <a target="blank" href={`/archive/invoices/${indexName}/documents/${row.original._id}`}>
                                        {row.value}
                                    </a>
                                );
                            }
                        },
                        {
                            id: 'start',
                            accessor: doc => format(doc._source.start, 'YYYY-MM-DD'),
                            Header: i18n.getMessage('Archive.table.columns.start.title')
                        },
                        {
                            id: 'sourceFrom',
                            accessor: '_source.receiver.protocolAttributes.from',
                            Header: i18n.getMessage('Archive.table.columns.from.title')
                        },
                        {
                            id: 'lastStatus',
                            accessor: '_source.lastStatus',
                            Header: t('Archive.table.columns.lastStatus')
                        }
                    ]}
                />

            </div>
        );
    }
}

