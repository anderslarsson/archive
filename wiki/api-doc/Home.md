## Classes

<dl>
<dt><a href="#User">User</a></dt>
<dd></dd>
</dl>

## Constants

<dl>
<dt><a href="#Logger">Logger</a></dt>
<dd><p>InvoiceArchive context module</p>
<p>This module is responsible for creating archiving jobs on the event bus. This
events will be consumed by the worker pool.</p>
</dd>
<dt><a href="#validTypes">validTypes</a></dt>
<dd><p>TenantConfig API handlers</p>
</dd>
<dt><a href="#elasticContext">elasticContext</a></dt>
<dd><p>InvoiceArchive API handlers</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#rotateTenantsDaily

Trigger the daily rotation of tenant transaction logs from
TX logs to archive.">rotateTenantsDaily

Trigger the daily rotation of tenant transaction logs from
TX logs to archive.(db)</a></dt>
<dd></dd>
<dt><a href="#rotateTenantsMonthly

Trigger the daily rotation of tenant specific archive index
to the yearly archive index.">rotateTenantsMonthly

Trigger the daily rotation of tenant specific archive index
to the yearly archive index.(db)</a> ⇒ <code>Integer</code></dt>
<dd></dd>
<dt><a href="#rotateGlobalDaily">rotateGlobalDaily()</a></dt>
<dd><p>Trigger copy job from daily bn_tx_logs-YYYY.MM.DD to archive_global_daily-YYYY.MM.DD</p>
</dd>
<dt><a href="#archiveTransaction">archiveTransaction(transactionId)</a> ⇒ <code>Boolean</code></dt>
<dd></dd>
<dt><a href="#init">init(app, db, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Initializes all routes for RESTful access.</p>
</dd>
<dt><a href="#get

Get a single document from the given index by its
transaction ID.">get

Get a single document from the given index by its
transaction ID.(req, res)</a></dt>
<dd></dd>
<dt><a href="#listAllByType">listAllByType()</a></dt>
<dd></dd>
<dt><a href="#openIndex">openIndex()</a></dt>
<dd><p>Open the given ES index and return the success of this operation.</p>
</dd>
<dt><a href="#get

Get all invoice indices for the tenant given in the request params.">get

Get all invoice indices for the tenant given in the request params.()</a></dt>
<dd></dd>
<dt><a href="#isAdmin">isAdmin()</a></dt>
<dd><p>TODO move to shared module</p>
</dd>
<dt><a href="#sendErrorResponse">sendErrorResponse()</a></dt>
<dd><p>TODO move to shared module</p>
</dd>
<dt><a href="#createArchiverJob

This API is called by external systems that want to trigger the archiving of a
a specific transaction.">createArchiverJob

This API is called by external systems that want to trigger the archiving of a
a specific transaction.(req, res, app, db)</a></dt>
<dd></dd>
<dt><a href="#createCuratorJob">createCuratorJob(req, res, app, db)</a></dt>
<dd></dd>
<dt><a href="#createDocument">createDocument(req, res, app, db)</a></dt>
<dd></dd>
<dt><a href="#search">search(req, res, app, db)</a></dt>
<dd><p>Search in a given index</p>
</dd>
<dt><a href="#search">search(req, res, app, db)</a></dt>
<dd><p>Scroll for a given scrollId</p>
</dd>
<dt><a href="#extractOwnerFromDocument">extractOwnerFromDocument()</a> ⇒ <code>String</code></dt>
<dd><p>Extract the owner information from a archive document.</p>
</dd>
<dt><a href="#extractTypeFromDocument

Extract the owner information from a archive document.">extractTypeFromDocument

Extract the owner information from a archive document.()</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#hasArchiving">hasArchiving(tenantId, tyoe)</a> ⇒ <code>Boolean</code></dt>
<dd></dd>
<dt><a href="#init">init(db, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Initializes all required database models using Sequelize.</p>
</dd>
<dt><a href="#up">up(data, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Inserts test data into existing database structures.
If all migrations were successul, this method will never be executed again.
To identify which migrations have successfully been processed, a migration&#39;s filename is used.</p>
</dd>
<dt><a href="#down">down(data, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Reverts all migrations for databse tables and data.
If the migration process throws an error, this method is called in order to revert all changes made by the up() method.</p>
</dd>
<dt><a href="#up">up(data, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Applies migrations for databse tables and data.
If all migrations were successul, this method will never be executed again.
To identify which migrations have successfully been processed, a migration&#39;s filename is used.</p>
</dd>
<dt><a href="#down">down(data, config)</a> ⇒ <code>Promise</code></dt>
<dd><p>Reverts all migrations for databse tables and data.
If the migration process throws an error, this method is called in order to revert all changes made by the up() method.</p>
</dd>
</dl>

<a name="User"></a>

## User
**Kind**: global class  

* [User](#User)
    * [new User()](#new_User_new)
    * [.id](#User.id)
    * [.tenantId](#User.tenantId)

<a name="new_User_new"></a>

### new User()
Data model representing a single user item.

<a name="User.id"></a>

### User.id
Unique identifier usually concatenated of federation id ':' and user id to ensure unique user names.

**Kind**: static property of [<code>User</code>](#User)  
<a name="User.tenantId"></a>

### User.tenantId
Identifier of supplier a user is assigned to.

**Kind**: static property of [<code>User</code>](#User)  
<a name="Logger"></a>

## Logger
InvoiceArchive context module

This module is responsible for creating archiving jobs on the event bus. This
events will be consumed by the worker pool.

**Kind**: global constant  
<a name="validTypes"></a>

## validTypes
TenantConfig API handlers

**Kind**: global constant  
<a name="elasticContext"></a>

## elasticContext
InvoiceArchive API handlers

**Kind**: global constant  
<a name="rotateTenantsDaily

Trigger the daily rotation of tenant transaction logs from
TX logs to archive."></a>

## rotateTenantsDaily

Trigger the daily rotation of tenant transaction logs from
TX logs to archive.(db)
**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| db | <code>Sequelize</code> | Sequelize db object |

<a name="rotateTenantsMonthly

Trigger the daily rotation of tenant specific archive index
to the yearly archive index."></a>

## rotateTenantsMonthly

Trigger the daily rotation of tenant specific archive index
to the yearly archive index.(db) ⇒ <code>Integer</code>
**Kind**: global function  
**Returns**: <code>Integer</code> - number of events created, should match the number of tenants with archive  

| Param | Type | Description |
| --- | --- | --- |
| db | <code>Sequelize</code> | Sequelize db object |

<a name="rotateGlobalDaily"></a>

## rotateGlobalDaily()
Trigger copy job from daily bn_tx_logs-YYYY.MM.DD to archive_global_daily-YYYY.MM.DD

**Kind**: global function  
<a name="archiveTransaction"></a>

## archiveTransaction(transactionId) ⇒ <code>Boolean</code>
**Kind**: global function  
**Returns**: <code>Boolean</code> - Indicates the success of job creation  

| Param | Type |
| --- | --- |
| transactionId | <code>String</code> | 

<a name="init"></a>

## init(app, db, config) ⇒ <code>Promise</code>
Initializes all routes for RESTful access.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Minimum setup](https://github.com/OpusCapita/web-init#minimum-setup)  

| Param | Type | Description |
| --- | --- | --- |
| app | <code>object</code> | [Express](https://github.com/expressjs/express) instance. |
| db | <code>object</code> | If passed by the web server initialization, a [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | Everything from [config.routes](https://github.com/OpusCapita/web-init) passed when running the web server initialization. |

<a name="get

Get a single document from the given index by its
transaction ID."></a>

## get

Get a single document from the given index by its
transaction ID.(req, res)
**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.params | <code>object</code> | POST data |
| req.params.indexId | <code>String</code> | Identifier of the ES |
| req.params.id | <code>String</code> | ID of the transaction |
| res | <code>express.Response</code> |  |

<a name="listAllByType"></a>

## listAllByType()
**Kind**: global function  
<a name="openIndex"></a>

## openIndex()
Open the given ES index and return the success of this operation.

**Kind**: global function  
<a name="get

Get all invoice indices for the tenant given in the request params."></a>

## get

Get all invoice indices for the tenant given in the request params.()
**Kind**: global function  
<a name="isAdmin"></a>

## isAdmin()
TODO move to shared module

**Kind**: global function  
<a name="sendErrorResponse"></a>

## sendErrorResponse()
TODO move to shared module

**Kind**: global function  
<a name="createArchiverJob

This API is called by external systems that want to trigger the archiving of a
a specific transaction."></a>

## createArchiverJob

This API is called by external systems that want to trigger the archiving of a
a specific transaction.(req, res, app, db)
**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.body | <code>object</code> | POST data |
| req.body.transactionId | <code>String</code> | ID of the transaction to archive |
| res | <code>express.Response</code> |  |
| app | <code>express.App</code> |  |
| db | <code>Sequelize</code> |  |

<a name="createCuratorJob"></a>

## createCuratorJob(req, res, app, db)
**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.body | <code>object</code> | POST data |
| req.body.period | <code>String</code> | Identifies the period that should be curated |
| res | <code>express.Response</code> |  |
| app | <code>express.App</code> |  |
| db | <code>Sequelize</code> |  |

<a name="createDocument"></a>

## createDocument(req, res, app, db)
**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.body | <code>object</code> | POST data |
| res | <code>express.Response</code> |  |
| app | <code>express.App</code> |  |
| db | <code>Sequelize</code> |  |

<a name="search"></a>

## search(req, res, app, db)
Search in a given index

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.body | <code>object</code> | POST data |
| req.body.transactionId | <code>String</code> | ID of the transaction to archive |
| res | <code>express.Response</code> |  |
| app | <code>express.App</code> |  |
| db | <code>Sequelize</code> |  |

<a name="search"></a>

## search(req, res, app, db)
Scroll for a given scrollId

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>express.Request</code> |  |
| req.body | <code>object</code> | POST data |
| req.body.scrollId | <code>String</code> | ID of the scroll API |
| res | <code>express.Response</code> |  |
| app | <code>express.App</code> |  |
| db | <code>Sequelize</code> |  |

<a name="extractOwnerFromDocument"></a>

## extractOwnerFromDocument() ⇒ <code>String</code>
Extract the owner information from a archive document.

**Kind**: global function  
**Returns**: <code>String</code> - tenantId  
**Params**: <code>object</code> doc  
<a name="extractTypeFromDocument

Extract the owner information from a archive document."></a>

## extractTypeFromDocument

Extract the owner information from a archive document.() ⇒ <code>String</code>
**Kind**: global function  
**Returns**: <code>String</code> - tenantId  
**Params**: <code>object</code> doc  
<a name="hasArchiving"></a>

## hasArchiving(tenantId, tyoe) ⇒ <code>Boolean</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| tenantId | <code>String</code> | 
| tyoe | <code>String</code> | 

<a name="init"></a>

## init(db, config) ⇒ <code>Promise</code>
Initializes all required database models using Sequelize.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Creating database models](https://github.com/OpusCapita/db-init#creating-database-models)  

| Param | Type | Description |
| --- | --- | --- |
| db | <code>object</code> | [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | Everything from [config.data](https://github.com/OpusCapita/db-init) passed when running the db-initialization. |

<a name="up"></a>

## up(data, config) ⇒ <code>Promise</code>
Inserts test data into existing database structures.
If all migrations were successul, this method will never be executed again.
To identify which migrations have successfully been processed, a migration's filename is used.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Applying data migrations](https://github.com/OpusCapita/db-init#applying-data-migrations)  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | A model property for database models and everything from [config.data](https://github.com/OpusCapita/db-init) passed when running the db-initialization. |

<a name="down"></a>

## down(data, config) ⇒ <code>Promise</code>
Reverts all migrations for databse tables and data.
If the migration process throws an error, this method is called in order to revert all changes made by the up() method.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Applying data migrations](https://github.com/OpusCapita/db-init#applying-data-migrations)  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | A model property for database models and everything from [config.data](https://github.com/OpusCapita/db-init) passed when running the db-initialization. |

<a name="up"></a>

## up(data, config) ⇒ <code>Promise</code>
Applies migrations for databse tables and data.
If all migrations were successul, this method will never be executed again.
To identify which migrations have successfully been processed, a migration's filename is used.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Applying data migrations](https://github.com/OpusCapita/db-init#applying-data-migrations)  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | A model property for database models and everything from [config.data](https://github.com/OpusCapita/db-init) passed when running the db-initialization. |

<a name="down"></a>

## down(data, config) ⇒ <code>Promise</code>
Reverts all migrations for databse tables and data.
If the migration process throws an error, this method is called in order to revert all changes made by the up() method.

**Kind**: global function  
**Returns**: <code>Promise</code> - JavaScript Promise object.  
**See**: [Applying data migrations](https://github.com/OpusCapita/db-init#applying-data-migrations)  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | [Sequelize](https://github.com/sequelize/sequelize) instance. |
| config | <code>object</code> | A model property for database models and everything from [config.data](https://github.com/OpusCapita/db-init) passed when running the db-initialization. |

