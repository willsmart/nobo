// template_manager
// © Will Smart 2018. Licence: MIT

// TODO this is the result of a rabid day's coding. Clean

const Parse5 = require('parse5');
//const Haml = require("haml");
const Connection = require('../db/postgresql-connection');
const SchemaToSQL = require('../db/postgresql-schema.js');
const processArgs = require('../general/process-args');
const strippedValues = require('../general/stripped-values');
const fs = require('fs');
const { promisify } = require('util');
const YAML = require('yamljs');

const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function execHaml(hamlFilename) {
  const htmlFilename = `${hamlFilename}.html`;
  console.log(`haml --trace "${hamlFilename}" "${htmlFilename}"`);
  const { stdout, stderr, error } = await exec(`haml --trace "${hamlFilename}" "${htmlFilename}"`);
  console.log(stdout);
  console.log(stderr);
  if (error) return;
  return await readFile_p(htmlFilename, 'utf8');
}

const readFile_p = promisify(fs.readFile);
const writeFile_p = promisify(fs.writeFile);
const readdir_p = promisify(fs.readdir);
const lstat_p = promisify(fs.lstat);

const appId = 1;
let connection;

// DB functions

async function getAppRow() {
  const rows = (await connection.query('SELECT * FROM app WHERE id = $1::integer', [appId])).rows;
  return rows && rows.length ? rows[0] : undefined;
}

async function ensureAppRow() {
  if (await getAppRow()) return;
  console.log(`Creating app with id ${appId}`);
  await connection.query('INSERT INTO app(id) VALUES ($1::integer);', [appId]);
}

async function findTemplateByFilename(filename) {
  const rows = (await connection.query(
    'SELECT * FROM template WHERE app_id=$1::integer AND filename=$2::character varying',
    [appId, filename]
  )).rows;
  return rows.length ? rows[0] : undefined;
}

// file system

async function dealWithTemplatesDirectory({
  path,
  templatesById,
  newTemplates,
  templatesByFilename,
  templatesByOwnershipClassVariant,
}) {
  const filenames = await readdir_p(path);

  for (const filename of filenames) {
    const filePath = `${path}/${filename}`;
    const stat = await lstat_p(filePath);
    if (stat.isDirectory()) {
      await dealWithTemplatesDirectory({
        path: filePath,
        templatesById,
        newTemplates,
        templatesByFilename,
        templatesByOwnershipClassVariant,
      });
    } else if (stat.isFile()) {
      await dealWithTemplateFile({
        filename,
        path: filePath,
        templatesById,
        newTemplates,
        templatesByFilename,
        templatesByOwnershipClassVariant,
      });
    }
  }
}

async function dealWithTemplateFile({
  filename,
  path,
  templatesById,
  newTemplates,
  templatesByFilename,
  templatesByOwnershipClassVariant,
}) {
  const templateFileRegex = /(?:^|\/)((my )?([\w]+)?(?:\[(\w+)\])?)(?:(\.haml)?\.html|\.haml)$/,
    match = templateFileRegex.exec(filename);
  const matchedFilename = match[1],
    ownerOnly = !!match[2],
    classFilter = match[3],
    variant = match[4];
  if (!match) {
    console.log(`Skipping '${filename}' (unknown name format)`);
    return;
  }
  if (match[5]) return; // .haml.html files are ignored

  if (templatesByFilename[matchedFilename]) {
    console.log(
      `Skipping duplicate filename '${filename}' at path ${path}, (the first file with this filename was at path ${
        templatesByFilename[matchedFilename].path
      })`
    );
    return;
  }

  const templatesByClassVariant = (templatesByOwnershipClassVariant[ownerOnly] =
      templatesByOwnershipClassVariant[ownerOnly] || {}),
    templatesByVariant = (templatesByClassVariant[classFilter] = templatesByClassVariant[classFilter] || {});
  if (templatesByVariant[variant || 'default']) {
    console.log(
      `Skipping duplicate template '${filename}' at path ${path}, (the first file with this combination of ownership, class filter, and variant was at path ${
        templatesByVariant[variant || 'default'].path
      })`
    );
    return;
  }

  const row = await findTemplateByFilename(matchedFilename),
    fileModifiedAt = '' + fs.statSync(path).mtime,
    modified = !row || row.file_modified_at != fileModifiedAt,
    includesTemplateFilenames =
      row && row.includes_template_filenames ? row.includes_template_filenames.split('|') : [];

  template = {
    path,
    row,
    filename: matchedFilename,
    fileModifiedAt,
    modified,
    includesTemplateFilenames,
    ownerOnly,
    classFilter,
    variant,

    displayedFields: {},
    subtemplates: {},
    children: {},

    mayHaveUnprocessedIncludes: true,
  };

  templatesByFilename[template.filename] = templatesByVariant[variant || 'default'] = template;

  if (row) templatesById[row.id] = template;
  else newTemplates.push(template);
}

// HTML and file processing

async function domForPath(path) {
  if (path.endsWith('.haml')) return await execHaml(path);
  else return await readFile_p(path, 'utf8');
}

async function processTemplateIncludes({ template, templatesByFilename }, stack = {}) {
  if (!template.mayHaveUnprocessedIncludes) return;

  if (!(template.dom || (template.dom = await domForPath(template.path)))) {
    console.log(`Couldn't read template file ${filename} (at ${path}). Skipping`);
    return;
  }
  if (!(template.roots || (template.roots = Parse5.parseFragment(template.dom).childNodes))) {
    console.log(`Couldn't parse template file ${filename} (at ${path}). Skipping`);
    return;
  }

  stack[template.filename] = true;

  template.includesTemplatesByFilename = {};

  async function checkForIncludeComment(node, index, siblings, templatesByFilename) {
    if (node.tagName == 'include') {
      const attrs = {};
      node.attrs.forEach(({ name, value }) => (attrs[name] = value));

      if (attrs.filename) {
        if (!templatesByFilename[attrs.filename]) {
          console.log(`Ignoring include of unknown template '${attrs.filename}' in template '${template.filename}'`);
        } else if (stack[attrs.filename]) {
          console.log(
            `Ignoring recursive include tag in template '${template.filename}'. Stack is ${JSON.stringify(stack)}`
          );
        } else {
          template.includesTemplatesByFilename[attrs.filename] = true;
          const subtemplate = templatesByFilename[attrs.filename];
          await processTemplateIncludes({ template: subtemplate, templatesByFilename }, stack);
          siblings.splice(index, 1, ...subtemplate.roots);
        }
      } else {
        console.log(`Ignoring include tag without filename in template '${template.filename}'`);
      }
      return;
    }

    if (node.childNodes) {
      let childIndex = 0;
      for (const child of node.childNodes) {
        await checkForIncludeComment(child, childIndex++, node.childNodes, templatesByFilename);
      }
    }
  }

  let index = 0;
  for (const root of template.roots) {
    await checkForIncludeComment(root, index++, template.roots, templatesByFilename);
  }

  delete stack[template.filename];
  delete template.mayHaveUnprocessedIncludes;
}

// main

(async function() {
  var args = processArgs();

  console.log('Read the template files and update the db templates');
  console.log('   args: ' + JSON.stringify(args));

  const templateDir = 'templates';
  const connectionFilename = 'db/connection.json';

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

  await ensureAppRow();

  const templatesByFilename = {},
    templatesById = {},
    templatesByOwnershipClassVariant = {},
    newTemplates = [],
    templatesWas = (await connection.query('SELECT id from template;')).rows.map(row => row.id);

  await dealWithTemplatesDirectory({
    path: templateDir,
    templatesByOwnershipClassVariant,
    templatesById,
    templatesByFilename,
    newTemplates,
  });

  function getModified(template) {
    if (template.modified) return true;
    for (const filename of template.includesTemplateFilenames) {
      const includedTemplate = templatesByFilename[filename];
      if (!includedTemplate || includedTemplate.modified) return (template.modified = true);
      if (includedTemplate.unmodified) return false;
      if (getModified(includedTemplate)) return (template.modified = true);
    }
    template.unmodified = true;
    return false;
  }

  for (const template of Object.values(templatesByFilename)) {
    if (!getModified(template)) continue;
    await processTemplateIncludes({ template, templatesByFilename });
  }

  for (const template of Object.values(templatesById)) {
    if (!template.modified) continue;

    console.log(`Template: ${template.filename} has changed dom or filename`);
    await connection.query(
      'UPDATE template SET dom=$1::text, includes_template_filenames=$2::text, filename=$3::character varying, file_modified_at=$4::character varying WHERE id=$5::integer;',
      [
        template.dom,
        Object.keys(template.includesTemplatesByFilename).join('|'),
        template.filename,
        template.fileModifiedAt,
        template.row.id,
      ]
    );

    template.modified = false;
  }

  for (const template of newTemplates) {
    console.log(`New template: ${template.filename}`);
    await connection.query(
      'INSERT INTO template(app_id, class_filter, dom, includes_template_filenames, filename, file_modified_at, owner_only, variant) VALUES ($1::integer, $2::character varying, $3::text, $4::text, $5::character varying, $6::character varying, $7::boolean, $8::character varying);',
      [
        appId,
        template.classFilter,
        template.dom,
        Object.keys(template.includesTemplatesByFilename).join('|'),
        template.filename,
        template.fileModifiedAt,
        template.ownerOnly,
        template.variant,
      ]
    );
    template.row = await findTemplateByFilename(template.filename);
    if (!template.row) {
      throw new Error('Failed to save template');
    }
    templatesById[template.row.id] = template;

    template.modified = false;
  }

  const deleteTemplates = templatesWas.filter(id => !templatesById[id]);
  if (deleteTemplates.length) {
    console.log(`Deleting ${deleteTemplates.length} template rows`);
    await connection.query('DELETE FROM template WHERE id = ANY ($1::integer[]);', [deleteTemplates]);
  }

  console.log('Done');
})();
