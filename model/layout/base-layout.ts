import { model, ModelClass as Class, LinkageArity as Link } from "./nobo-model";

const ModelChangeLog = model(
    { name: "ModelChangeLog", as: "modelChange" },
    {
      type: { clas: Class.string },
      rowId: { clas: Class.integer },
      field: { clas: Class.string },
      at: { clas: Class.datetime, default: "now" },

      notifyRequest: {
        clas: "ModelChangeNotifyRequest",
        linkage: Link.oneLink,
        children: {
          at: { clas: Class.datetime, default: "now" },
          name: { clas: Class.string },
        },
      },
    }
  ),
  SchemaHistory = model("SchemaHistory", {
    modelLayout: { clas: Class.text },
    layoutToSchemaVersion: { clas: Class.string },
    at: { clas: Class.datetime, default: "now" },
  }),
  App = model("App", {
    name: { clas: Class.string },
    cookiePrefix: { clas: Class.string, default: "noboapp" },

    users: {
      clas: "User",
      linkage: Link.manyChildren,
      children: {
        phoenixKey: { clas: Class.string },
      },
    },

    // A template is some DOM block that can be customised with a model (i.e. a row in a table), and inserted into a document
    templates: {
      clas: "Template",
      linkage: Link.manyChildren,
      children: {
        // the following three properties determine whether or not the system should choose this template as the view, given a particulat model
        // the classFilter is NULL if the template can apply to any model type, otherwise it specified the model type that this template can apply to
        classFilter: { clas: Class.string },
        // if set, this template is only viewable by the owner of the model it shows
        ownerOnly: { clas: Class.boolean, default: false },
        // the variant allows a particular type of view on a model to be requested. For example you could request the 'tablerow' variant for a user model
        variant: { clas: Class.string },

        // the dom string that will be inserted into the document (after customization using the model)
        dom: { clas: Class.text },

        // the original file that this template was loaded from
        filename: { clas: Class.string },

        // ==== links

        // a template may show a number of fields, so clients viewing the template will need to be updated if they change
        displayedFields: {
          clas: "TemplateDisplayedField",
          linkage: Link.manyChildren,
          children: {
            field: { clas: Class.string },
          },
        },
        // a template may invoke other templates to embed within it.
        // Eg a user template may display its name as editable textbox using a reusable component, rather than including the specifics in each template that uses that type of textbox.
        subtemplates: {
          clas: "Subtemplate",
          linkage: Link.manyChildren,
          children: {
            // the domField is the name of the subtemplate as displayed in the final document. It can be any string.
            domField: { clas: Class.string },
            // the variant to use when finding the template to use for this subtemplate
            variant: { clas: Class.string },
            // if specified, this can specify the model to use for the subtemplate. This is often 'user__me' allowing a page to have a sensible nav bar.
            modelView: { clas: Class.string },
          },
        },
        // a template may display child models. Eg a user template may display its posts, so the template for the user would have a posts subtemplate saying how to display them
        templateChildren: {
          clas: "TemplateChild",
          linkage: Link.manyChildren,
          children: {
            // the domField is the name of the template child as displayed in the final document. It can be any string.
            domField: { clas: Class.string },
            // the name of the link hanging off this model (eg posts)
            modelField: { clas: Class.string },
            // the variant to use when finding the template to use for this child
            variant: { clas: Class.string },
            // the classFilter is NULL if the template can apply to any model type, otherwise it specified the model type that this template can apply to
            classFilter: { clas: Class.string },
            // if set, this template is only viewable by the owner of the model it shows
            ownerOnly: { clas: Class.boolean, default: false },
          },
        },
      },
    },
  });

export default [App, SchemaHistory, ModelChangeLog];
