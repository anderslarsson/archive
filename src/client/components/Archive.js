import React from 'react';
import moment from 'moment';
import ReactTable from 'react-table';
import Select from '@opuscapita/react-select';
import {Components} from '@opuscapita/service-base-ui';

import {Elastic} from '../api';
import translations from './i18n';
import 'react-table/react-table.css';
import 'react-select/dist/react-select.css';

export default class Archive extends Components.ContextComponent {

    constructor(props, context) {
        super(props);

        this.state = {
            loading: false,
            files: [],
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

        this.elasticApi = new Elastic();
        context.i18n.register('Archive', translations);
    }

    componentDidMount() {
        this.fetchTenantOptions();
    }

    fetchTenantOptions() {
        this.elasticApi.getTenantOptions()
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
        this.elasticApi.getYearOptions(tenantId)
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
        return availableOptions.years.map(year => ({value: year, label: year}));
    }

    handleTenantSelection(data) {
        const {selectedValues} = this.state;
        selectedValues.tenant = data.value;
        this.setState({selectedValues});

        this.fetchYearOptions(data.value);
    }

    handleYearSelection(value) {
        const {selectedValues} = this.state;
        selectedValues.year = value;
        this.setState({selectedValues});
    }

    resetSearchForm(e) {
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
        e && e.preventDefault();

        const {selectedValues} = this.state;

        if (!selectedValues.tenant || !selectedValues.year) {
            this.setState({files: []});
            return;
        }

        this.loading = true;
        this.elasticApi.queryInvoiceArchive(selectedValues)
            .then(response => {
                this.setState({files: response.data});
            })
            .catch((err) => {
                this.context.showNotification(err.message, 'error', 10);
            })
            .then(() => this.loading = false);
    }

    render() {
        const {i18n} = this.context;
        const {loading, files, availableOptions, selectedValues} = this.state;

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
                                                <input type="text" className="form-control"/>
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
                                                <input type="text" className="form-control"/>
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
                                                <input type="text" className="form-control"/>
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
                    data={files}
                    minRows={0}
                    loading={loading}
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
                            accessor: 'transactionId',
                            Header: i18n.getMessage('Archive.table.columns.id.title')
                        },
                        {
                            accessor: 'invoiceNo',
                            Header: i18n.getMessage('Archive.table.columns.no.title')
                        },
                        {
                            accessor: 'from',
                            Header: i18n.getMessage('Archive.table.columns.from.title')
                        },
                        {
                            accessor: 'to',
                            Header: i18n.getMessage('Archive.table.columns.to.title')
                        },
                        {
                            id: 'startDate',
                            accessor: file => moment(file.startDate).format('YYYY-MM-DD'),
                            Header: i18n.getMessage('Archive.table.columns.startDate.title')
                        },
                        {
                            id: 'endDate',
                            accessor: file => moment(file.endDate).format('YYYY-MM-DD'),
                            Header: i18n.getMessage('Archive.table.columns.endDate.title')
                        },
                        {
                            id: 'actions',
                            accessor: user => user,
                            width: 100,
                            Cell: ({value}) =>
                                <nobr>
                                    <button type="button" className="btn btn-sm btn-default">
                                        <span className="icon glyphicon glyphicon-doc"/>&nbsp;
                                        {i18n.getMessage('Archive.table.columns.actions.detail')}
                                    </button>
                                </nobr>
                        }
                    ]}
                />
            </div>
        );
    }
}

