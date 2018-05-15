// template_manager
// © Will Smart 2018. Licence: MIT

// TODO this is the result of a rabid day's coding. Clean

const Parse5 = require("parse5");
const Haml = require("haml");
const Connection = require("../db/postgresql-connection");
const SchemaToSQL = require("../db/postgresql-schema.js");
const processArgs = require("../general/process-args");
const strippedValues = require("../general/stripped-values");
const fs = require("fs");
const { promisify } = require("util");
const YAML = require("yamljs");

const readFile_p = promisify(fs.readFile);
const writeFile_p = promisify(fs.writeFile);
const readdir_p = promisify(fs.readdir);
const lstat_p = promisify(fs.lstat);

async function forEachPromise(iterable, callback) {
  let chain = undefined;
  callbackEnsuringPromise = (value, index, array, result, err) => {
    const res = callback(value, index, array, result, err);
    if (res.then) return res;
    return Promise.resolve(res);
  };

  iterable.forEach((value, index, array) => {
    let localCallback = callbackEnsuringPromise.bind(this, value, index, array);
    chain = chain ? chain.then(localCallback) : localCallback();
  });
  return chain || Promise.resolve();
}

(async function() {
  var args = processArgs();

  console.log("Read the template files and update the db templates");
  console.log("   args: " + JSON.stringify(args));

  const templateFileRegex = /(?:^|\/)((my )?([\w]+)?(?:\[(\w+)\])?)\.html(\.haml)?/;

  const templateDir = "templates";
  const connectionFilename = "db/connection.json";

  let connection;
  try {
    const connectionInfo = JSON.parse(await readFile_p(connectionFilename));
    connection = new Connection(connectionInfo);
  } catch (err) {
    console.log(`
    ${err}
    
    Please check that the connection info in the ${connectionFilename} file is correct
`);
    return;
  }

  const newTemplateInfos = {};

  async function dealWithTemplateFile({ filename, path }) {
    const match = templateFileRegex.exec(filename);
    if (!match) {
      console.log(`Skipping '${filename}' (unknown name format)`);
      return;
    }

    const isHaml = match[5];

    let body = await readFile_p(path, "utf8");
    if (isHaml) {
      body = Haml(body, { escapeHtmlByDefault: true })();
    }

    const template = {
      filename: match[1],
      ownerOnly: !!match[2],
      classFilter: match[3],
      variant: match[4],

      displayedFields: {},
      subtemplates: {},
      children: {},

      mayHaveUnprocessedIncludes: true,
      dom: body,
      roots: Parse5.parseFragment(body).childNodes
    };

    newTemplateInfos[template.filename] = template;
  }

  function processTemplateIncludes(template, stack = {}) {
    if (!template.mayHaveUnprocessedIncludes) return;

    stack[template.filename] = true;

    function checkForIncludeComment(node, index, siblings) {
      if (node.tagName == "include") {
        const attrs = {};
        node.attrs.forEach(({ name, value }) => (attrs[name] = value));

        if (attrs.filename) {
          if (!newTemplateInfos[attrs.filename]) {
            console.log(`Ignoring include of unknown template '${attrs.filename}' in template '${template.filename}'`);
          } else if (stack[attrs.filename]) {
            console.log(
              `Ignoring recursive include tag in template '${template.filename}'. Stack is ${JSON.stringify(stack)}`
            );
          } else {
            const subtemplate = newTemplateInfos[attrs.filename];
            processTemplateIncludes(subtemplate, stack);
            siblings.splice(index, 1, ...subtemplate.roots);
          }
        } else {
          console.log(`Ignoring include tag without filename in template '${template.filename}'`);
        }
        return;
      }

      if (node.childNodes) {
        node.childNodes.forEach((child, childIndex, childNodes) =>
          checkForIncludeComment(child, childIndex, childNodes)
        );
      }
    }

    template.roots.forEach((root, index, roots) => checkForIncludeComment(root, index, roots));

    delete stack[template.filename];
    delete template.mayHaveUnprocessedIncludes;
  }

  function processTemplate(template) {
    //console.log(`    Template file '${path}'`);

    function escape(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/>/g, "&gt;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }

    const addDisplayedFieldsInString = function(string) {
      if (!string) return;
      const fieldRegEx = /\$\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|&[lg]t;=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}/g;
      let match;
      while ((match = fieldRegEx.exec(string))) {
        const field = match[1];
        template.displayedFields[field] = {
          field
        };
      }
    };

    const gatherParts = function(node, indent) {
      if (node.attrs) {
        const attrs = {};
        node.attrs.forEach(({ name, value }) => (attrs[name] = value));

        const clas = attrs.class;
        const variant = attrs.variant;
        const modelView = attrs.model;

        if (clas) {
          let match;
          if ((match = /(?:^|\s)([\w0-9]+)-subtemplate(?:$|\s)/.exec(clas))) {
            let index = 1,
              domField = match[1];
            while (template.subtemplates[domField]) {
              domField = `${match[1]}-${++index}`;
            }
            template.subtemplates[domField] = {
              domField,
              variant,
              modelView
            };
          } else if ((match = /(?:^|\s)(?:subtemplate-uses-)?([\w0-9]+)-model-child(?:$|\s)/.exec(clas))) {
            const modelField = match[1];
            let index = 1,
              domField = modelField;
            while (template.children[domField]) {
              domField = `${modelField}-${++index}`;
            }
            template.children[domField] = {
              domField,
              modelField,
              variant
            };
          }
        }

        Object.keys(attrs).forEach(name => {
          addDisplayedFieldsInString(escape(attrs[name]));
        });
      }

      addDisplayedFieldsInString(node.data);
      addDisplayedFieldsInString(node.value);

      if (node.childNodes) {
        node.childNodes.forEach(child => gatherParts(child, indent + "  "));
      }
    };
    template.roots.forEach(node => gatherParts(node, ""));
  }

  function processTemplates() {
    Object.keys(newTemplateInfos).forEach(filename => {
      processTemplateIncludes(newTemplateInfos[filename]);
    });
    Object.keys(newTemplateInfos).forEach(filename => {
      processTemplate(newTemplateInfos[filename]);
    });
  }

  async function dealWithTemplatesDirectory({ path }) {
    const filenames = await readdir_p(path);
    await forEachPromise(filenames, async function(filename) {
      const filePath = `${path}/${filename}`;
      const stat = await lstat_p(filePath);
      if (stat.isDirectory()) {
        await dealWithTemplatesDirectory({ path: filePath });
      } else if (stat.isFile()) {
        await dealWithTemplateFile({ filename, path: filePath });
      }
    });
  }

  await dealWithTemplatesDirectory({ path: templateDir });

  const templateHolderId = 1;
  await ensureTemplateHolder();
  processTemplates();

  async function ensureTemplateHolder({ dbRowId = templateHolderId } = {}) {
    const sql = "SELECT * FROM template_holder WHERE id = $1::integer",
      args = [dbRowId];
    const rows = (await connection.query(sql, args)).rows;
    if (rows.length) return rows[0];
    console.log(`New template holder`);
    await connection.query("INSERT INTO template_holder(id) VALUES ($1::integer);", [dbRowId]);
    return (await connection.query(sql, args)).rows[0];
  }

  async function findTemplateBy({ variant, classFilter, ownerOnly }) {
    const args = [templateHolderId];
    let sql = "SELECT * FROM template WHERE template_holder_id=$1::integer";

    if (variant) {
      sql += ` AND variant=$${args.length + 1}::character varying`;
      args.push(variant);
    } else sql += " AND variant IS NULL";

    if (classFilter) {
      sql += ` AND class_filter=$${args.length + 1}::character varying`;
      args.push(classFilter);
    } else sql += " AND class_filter IS NULL";

    sql += ` AND owner_only=$${args.length + 1}::boolean`;
    args.push(!!ownerOnly);

    const rows = (await connection.query(sql, args)).rows;

    return rows.length ? rows[0] : undefined;
  }

  async function findDisplayedFieldBy({ templateId, field }) {
    const rows = (await connection.query(
      "SELECT * FROM template_displayed_field WHERE template_id=$1::integer AND field=$2::character varying;",
      [templateId, field]
    )).rows;

    return rows.length ? rows[0] : undefined;
  }

  async function findSubtemplateBy({ templateId, domField }) {
    const rows = (await connection.query(
      "SELECT * FROM subtemplate WHERE template_id=$1::integer AND dom_field=$2::character varying;",
      [templateId, domField]
    )).rows;

    return rows.length ? rows[0] : undefined;
  }

  async function findTemplateChildBy({ templateId, domField }) {
    const rows = (await connection.query(
      "SELECT * FROM template_child WHERE template_id=$1::integer AND dom_field=$2::character varying;",
      [templateId, domField]
    )).rows;

    return rows.length ? rows[0] : undefined;
  }

  ids = {
    templates: {},
    displayedFields: {},
    subtemplates: {},
    templateChildren: {},

    templatesWas: (await connection.query("SELECT id from template;")).rows.map(row => row.id),
    displayedFieldsWas: (await connection.query("SELECT id from template_displayed_field;")).rows.map(row => row.id),
    subtemplatesWas: (await connection.query("SELECT id from subtemplate;")).rows.map(row => row.id),
    templateChildrenWas: (await connection.query("SELECT id from template_child;")).rows.map(row => row.id)
  };

  newTemplates = [];
  Object.keys(newTemplateInfos).forEach(filename => newTemplates.push(newTemplateInfos[filename]));

  await forEachPromise(newTemplates, async function({
    filename,
    ownerOnly,
    classFilter,
    variant,
    dom,
    displayedFields,
    subtemplates,
    children
  }) {
    let template = await findTemplateBy({ ownerOnly, classFilter, variant });
    if (!template) {
      console.log(`New template: ${filename}`);
      await connection.query(
        "INSERT INTO template(template_holder_id, class_filter, dom, filename, owner_only, variant) VALUES ($1::integer, $2::character varying, $3::text, $4::character varying, $5::boolean, $6::character varying);",
        [templateHolderId, classFilter, dom, filename, ownerOnly, variant]
      );
      template = await findTemplateBy({ ownerOnly, classFilter, variant });
      if (!template) {
        throw new Error("Failed to save template");
      }
    }
    const templateId = template.id;
    ids.templates[templateId] = true;

    if (template.dom != dom || template.filename != filename) {
      console.log(`Template: ${filename} has changed dom or filename`);
      connection.query("UPDATE template SET dom=$1::text, filename=$2::character varying WHERE id=$3::integer;", [
        dom,
        filename,
        templateId
      ]);
    }

    await forEachPromise(Object.keys(displayedFields), async function(field) {
      let displayedField = await findDisplayedFieldBy({ templateId, field });
      if (!displayedField) {
        console.log(`New displayed field ${field} in template ${filename}`);
        await connection.query(
          "INSERT INTO template_displayed_field(template_id, field) VALUES ($1::integer, $2::character varying);",
          [templateId, field]
        );
        displayedField = await findDisplayedFieldBy({ templateId, field });
        if (!displayedField) {
          throw new Error("Failed to save displayed field");
        }
      }
      ids.displayedFields[displayedField.id] = true;
    });

    await forEachPromise(Object.keys(subtemplates), async function(domField) {
      const subtemplateInfo = subtemplates[domField];

      let subtemplate = await findSubtemplateBy({ templateId, domField });
      if (!subtemplate) {
        console.log(`New subtemplate ${domField} in template ${filename}`);
        await connection.query(
          "INSERT INTO subtemplate(template_id, dom_field, model_view, variant) VALUES ($1::integer, $2::character varying, $3::character varying, $4::character varying);",
          [templateId, domField, subtemplateInfo.modelView, subtemplateInfo.variant]
        );
        subtemplate = await findSubtemplateBy({ templateId, domField });
        if (!subtemplate) {
          throw new Error("Failed to save subtemplate");
        }
      }
      ids.subtemplates[subtemplate.id] = true;

      if (subtemplate.model_view != subtemplateInfo.modelView || subtemplate.variant != subtemplateInfo.variant) {
        console.log(`Subtemplate ${domField} of template ${filename} has changed model or variant`);
        connection.query(
          "UPDATE subtemplate SET model_view=$1::character varying, variant=$2::character varying WHERE id=$3::integer;",
          [subtemplateInfo.modelView, subtemplateInfo.variant, subtemplate.id]
        );
      }
    });

    await forEachPromise(Object.keys(children), async function(domField) {
      const childInfo = children[domField];

      let child = await findTemplateChildBy({ templateId, domField });
      if (!child) {
        console.log(`New template child ${domField} in template ${filename}`);
        await connection.query(
          "INSERT INTO template_child(template_id, dom_field, model_field, variant) VALUES ($1::integer, $2::character varying, $3::character varying, $4::character varying);",
          [templateId, domField, childInfo.modelField, childInfo.variant]
        );
        child = await findTemplateChildBy({ templateId, domField });
        if (!child) {
          throw new Error("Failed to save template child");
        }
      }
      ids.templateChildren[child.id] = true;

      if (child.model_field != childInfo.modelField || child.variant != childInfo.variant) {
        console.log(`Child ${domField} of template ${filename} has changed field or variant`);
        connection.query(
          "UPDATE template_child SET model_field=$1::character varying, variant=$2::character varying WHERE id=$3::integer;",
          [childInfo.modelField, childInfo.variant, child.id]
        );
      }
    });
  });

  ids.deleteTemplates = ids.templatesWas.filter(id => !ids.templates[id]);
  ids.deleteDisplayedFields = ids.displayedFieldsWas.filter(id => !ids.displayedFields[id]);
  ids.deleteSubtemplates = ids.subtemplatesWas.filter(id => !ids.subtemplates[id]);
  ids.deleteTemplateChildren = ids.templateChildrenWas.filter(id => !ids.templateChildren[id]);

  if (ids.deleteTemplates.length) {
    console.log(`Deleting ${ids.deleteTemplates.length} template rows`);
    await connection.query("DELETE FROM template WHERE id = ANY ($1::integer[]);", [ids.deleteTemplates]);
  }
  if (ids.deleteDisplayedFields.length) {
    console.log(`Deleting ${ids.deleteDisplayedFields.length} displayed field rows`);
    await connection.query("DELETE FROM template_displayed_field WHERE id = ANY ($1::integer[]);", [
      ids.deleteDisplayedFields
    ]);
  }
  if (ids.deleteSubtemplates.length) {
    console.log(`Deleting ${ids.deleteSubtemplates.length} subtemplate rows`);
    await connection.query("DELETE FROM subtemplate WHERE id = ANY ($1::integer[]);", [ids.deleteSubtemplates]);
  }
  if (ids.deleteTemplateChildren.length) {
    console.log(`Deleting ${ids.deleteTemplateChildren.length} template child rows`);
    await connection.query("DELETE FROM template_child WHERE id = ANY ($1::integer[]);", [ids.deleteTemplateChildren]);
  }

  console.log("Done");
})();
