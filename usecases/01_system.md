# Archive

Archive will be a separate service that publishes an API to interact with it.
Also it will expose a UI component that allows to interactively search archive and download files.

Archive is a general purpose service to be used by multiple product services, so it is kept generic.

Archive is read-only when it comes to searching, downloading. Only write option is when adding a file to archive.

Archive will take care of deleting files after retention period expires.
For this purpose we need to configure retention interval either on file or docType level 

In order to satisfy use cases we need to support searchable keywords per archive entry.
This could be transactionId, document Number (=InvoiceId, PurchaseOrder Number), date/time, supplier, customer

Product services are responsible for archiving, that is adding files/documents to archive and deleting them from product service storage once successfully archived.

## Technical Prerequisites

Azure storage account v2 comes with 3 store tiers

* Hot
* Cool
* Archive

We can currently utilize Hot/Cool in Amsterdam, Archive not implemented yet.

The storage tier can be switched per file via API, synchronous between Hot / Cool, but takes up to 15 hours for Cool/Archive.

The current blob service implementation is ignorant of storage tiers, but that support could be added.
The current andariel blob storage accounts are v1, so we need to perform infrastructure upgrades in order to activate the functionalities.

Azure currently lists blob with prefix filtering, independent of storage tier (Tier level is included in result only but not available as filter).

We can hence assume that keeping all files in one directory will grow this quite much and listing blobs might become slower over time.

# Risk factors

* Backup: Although the system is designed as a readonly service we need to take care of programming errors resulting in data loss. Thus a backup strategy is neccessary.
* From a legal standpoint we need to ensure that every invoice is received by the archive

# System Level Use Case Diagram

* Supplier
    * tba
* Customer
    * Access archive (via billing)
    * Search in Hot archive
    * Search in Cold archive
* Customer Admin
    * tba
* OCAdmin
    * tba

# Architecture Diagram
<Include a description of the interfaces as well. These could be on the diagram, or listed in text.>

# Subsystem Descriptions
<Include a brief description of each subsystem.>
