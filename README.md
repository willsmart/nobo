# nobo - Say no to boiler-plate code
I'm planning for this to end up an awesome holistic framework for writing reactive web apps with little to no code

MIT licence

Why?
=========

I love the way things are going. Websites are getting slick and reactive. Things are looking good for coders.
But surely we are all a little sick of writing masses of code to support our models and views. Shouldn't that bve something we can get the computer to do?

What?
=========
The aspirational goal of nobo is to allow anyone to make a simple reactive site with no code, and a complex site by adding only non-generic code.

The Parts
--------

### Database (bin/update-db-schema, db/layout/model-layout.yaml)

nobo works using close database binding. The database chosen at this point is postgresql.
Running the bin/update-db-schema script will effect the layout contained in the file(s) in the db/layouts dir as tables in the db.
Each field in each table is given smart change triggers, so no matter how things change, nobo is notified, and clients are updated (even if the change was done in a database editor like Valentina Studio).

The layout file is a simplified model tree. More docs to come.

### Page server (bin/start-page-server, tools/page-server)


...

For now it's mostly a long todo list..
- 
