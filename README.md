# NoBo - Say no to boiler-plate code
For now it is very much under-construction, but the plan is for NoBo to end up an awesome holistic framework for writing reactive web apps with little to no non-essential code. 

[(skip to quick start)](#quick-start)

# Why?

I'm Will. I've programmed for three decades touching on every level of the stack about half and half between academia and business. In that time I've written several small frameworks easing development for various platforms. Nowdays I know what I like and for frameworks it mostly centers around letting users of it stay nicely DRY and KISS.

I love the way things are going! Websites are slick, responsive, and reactive. Things are looking really good for coders. We've got HTML5. Modern JS completely rocks.

... But *surely* we are all a little sick of writing masses of boilerplate code to support our models and views. Shouldn't that be something we can offload to the underlying system?

Well, yes. Hence NoBo.

### A note on style (or, why the lack of dependencies?)

I unashamedly admit that much of this code reinvents the wheel. You know ho else does? Tesla, that's who. It's not always a bad thing. 

I'm not going to write my own websocket layer (well, not this time!) but in general when faced with a programming problem that could be solved with 200 lines of code I will do that rather than using an off the shelf tool to do it for me. Call it a personal style choice that may explain some of the bespoke-code in NoBo.

As the project moves on I expect some of this bespoke code will be swapped out for more convential tools.

# What is NoBo?

The aspirational goal of NoBo is to allow anyone to make a simple reactive site with no code, and a complex site by adding only non-generic code. To that end NoBo scraps a lot of the code that you'd write to support a framework like react.

NoBo is an opinionated but general framework.

Core concepts
---------
To make a NoBo app, you specify a model in YAML or JSON files. Something along the lines of:

(db/layout/mymodels.json)

    user(User):
        name(String): {}
        ~< posts(Post):
            body(string): {}
            userName(string): {get: 'user.name'}
            ...

... then you also specify views via HAML or HTML files. Something along the lines of:

(templates/User.haml)

    .user
        %h2
            ${name||'<unnamed user>'}
        .posts-model-child{variant: 'row'}
        
(templates/Post[row].haml)

    .post
        %small
            ${userName?'(post by '+userName+')':''}
        ${body}
        
... then you start your app

The above code is enough to show a 

# Quick start

Run the following in a terminal:

    bash <(curl -s https://raw.githubusercontent.com/willsmart/nobo/master/bin/generate-app)

That setup script lives in `bin/generate-app` and is used to both setup and reconfigure the app. It will go through following steps:
1. Create the app repo
2. Setup db connection parameters. This step requires a running postgresql host.
3. Setup the secrets dir.
4. Run the joiner
5. Create the database
6. Update database schema and templates

# Tools overview

- Start the joiner script: `nobo/bin/start-joiner`
- Push the model layout files up to the database: `joined/bin/update-db-schema`
- Pushing the views up to the database: `joined/bin/update-db-templates`
- Bundling: `joined/bin/bundle-client`
- Start the model-server: `joined/bin/start-model-server --prompter`
- Start the page-server: `joined/bin/start-page-server`
- Start both in the background: `joined/bin/start-servers`
- Kill the servers: `joined/bin/kill-servers`

## Joiner

We have all come upon the problem of specializing a general platform to conform to a specific app. I seem to a lot anyway.
NoBo solves this problem using a Joiner script.

In essence the joiner takes the contents of the `nobo`, `app`, `secrets`, and `production`, `deploy` or `development` directory trees, merges them, and spits them out to the `joined` directory tree. 
It also spits things the other way, intelligently passing files back to the most appropriete source. Typical development occurs in the `joined` directory tree. Typically `nobo` is this repository added to a projects as a submodule.

To develop or run NoBo as an app, the joiner script must be running. Use the following in a spare terminal: 

    #> nobo/bin/start-joiner

(optionally suffix with & to push it to the background. Also it's a very general script, feel free to use elsewhere)

## Database 

NoBo works is currently tightly coupled with postgresql.
Database setup and migration is handled by the `joined/bin/update-db-schema` script which tweaks the db schema to match the combined contents of layout files in the `joined/db/layout` directory. I.e. to migrate or setup the db, run:

    #> joined/bin/update-db-schema

To seed, run:

    #> joined/bin/seed-db

## Views

NoBo runs as a single page app (SPA) with views sourced from the `joined/templates/` directory and its subdirectories and commited into the db for use by the app. After editing the templates, run the following to update the db templates:

    #> joined/bin/update-db-templates

## Servers

NoBo includes two servers: the `page-server` and the `model-server`

`page-server` serves up a static page with the NoBo client code and a small ammount of HTML. When developing you'll point your browser to it. To start it run:

    #> joined/bin/start-page-server

 The planned deploy script will run the page-server and save the resulting static page in S3. `page-server` is not in any way intended to be used in production.

 `model-server` serves up web-sockets to clients, and is intended to be used as the production server (through probably behind a proxy).
 All communication with the client passes through the web-socket, including model retrieval and actions. To start the first instance run:

    #> joined/bin/start-model-server --prompter

If there are multiple `model-server`'s using the same connection info, other instances should not include the `--prompter` flag which starts up additional db management code that must be run on exactly one server. I.e. start them using:

    #> joined/bin/start-model-server

# Deeper dive into the parts

## Database Schema

The layout files under `joined/db/layout` are either YAML or JSON files holding a simplified model tree structure.
The NoBo specific tables are introduced by the `base-layout.yaml` file, so `/app/db/layout` need only contain app specific models.

An simple YAML layout coverin most of the bases could be:

    - app(App):
        name(string): {}
        
        ~< users(User):
            name(string): {default: "Unnamed user"}
            appName(string): {get: "app.name"}

            ~< posts(Post):
                as: user
                body(string): {}

    - User:
        breadcrumbTitle(string): {get: "'<'+name+'>'"}

Unpacking that...
- `- app(App):` opens the `App` type. Types are always held in parantheses. Capitalized types are user models (i.e. db tables). Lower-case types are built in types like `string` or `boolean`.
- `name(string): {}` gives each `App` a `name` property, that is a string.
- `~< users(User):` opens a link property `users` of app. I.e. each app will have a `users` property that has type `User`. Since it is a link, it also creates a backward link `app` on each `User`. The link type `~<` indicates there are many users for each one app, and that the `app.users` property is virtual (the `~`. I.e. the db has no entry for an app's users, they are obtained by the reverse look up for users with that app.)
- `name(string): {default: "Unnamed user"}` gives each `User` a `name` property, with a default value of "Unnamed user".
- `appName(string): {get: "app.name"}` gives each `User` a different type of virtual property; each `User` will have a `appName` property that evaluates to the `name` property of the the user's `app`. NoBo will treat this as a first-class property that is indistinguishable from the clients point of view from a db backed property.
- `~< posts(Post):` creates another link property
- `as: user`. The `posts` property creates a reverse property referring to the `Post`'s user. You'd expect this to be called `Post.user`. NoBo does not currently auto-convert to the singular, so this line lets it know that for the purposes of this link property, the parent is called `user`.
- `User:` the alternative way to open a class is by using the capitalized class name.

Each field in each table is given smart change triggers, so no matter how things change, NoBo is notified, and clients are updated (even for virtual properties, and even if the change was done in a database editor).


## Page server (joined/bin/start-page-server, tools/page-server)


...

For now it's mostly a long todo list..
- 


(Nobo is on the MIT licence)
