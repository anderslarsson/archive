# General Invoice seach

User needs to search in the associated tenants invoices to access documents. Documents are archived for customer specific retention period.

# Actors

* Customer
* Buyer 

# Priority

High

# Status

Planned

# Pre-Conditions

1. The user is a registered BNP user
2. The user has 1-n associated tenant(s)
3. The user has setup up billing

# Post-Conditions

* The user is presented a list of search results

# Flow of Events

1. The user accesses the archiving service and selects one of the two archives
    * Hot
    * Cold
2. After the archive is ready the user is presented search options specific to invoices
3. The user selects her search options/filter criteria
4. The user is presented the list of results.

# User Interface
<For systems which interface with people, include a description of the user interface, possibly using storyboards.>

# Scenarios

The user needs to be able to search for the following criteria.

## Criteria supported by existing M-Files solution
    * From address
    * To address
    * Date
    * E-Mail text

## Criteria supported by the in-development Track and Trace service

The checkbox denotes the availability of the information in the current TnT log message schema (12.06.2018).

* [x] Customer
* [x] Buyer
* [ ] From address
* [ ] To address (relevant if many buyers)
* [ ] Email subject
* [x] SendDate and SendTime range, narrow down
* [x] Original PDF/Tiff names
* [ ] Our new OC image name, "correlation" to the original attachment name
* [ ] Invoice number, from Exela metadata - nice to have
* [ ] Supplier VAT?, from Exela metadata – nice to have
* [ ] Invoice number
* [ ] Payment reference
* [ ] PO Number
* [x] Invoice category: Sales or Purchase
* [x] Invoice date Start - End
* [ ] Due date Start - End
* [x] Invoice receiver - Customer number, Customer name, Customer ID
* [x] Invoice sender
* [ ] Electronic invoice id(EBID)
* [ ] Custom meta-data parameters. In this case the tag and/or the associated value can be entered
* [ ] Supplier and Buyer country
* [ ] Supplier and Buyer tax (VAT) number(s)

# Diagram of Participating Objects
<A class diagram showing all the classes whose objects interact to implement this use case. You can also show interfaces to the Use Case here, and which of the classes implement the interfaces.> 

# Other Artifacts
<This can include references to the subsystem the Use Case belongs to, an analysis model, a design model, code, or test plans.>
