// template_manager
// © Will Smart 2018. Licence: MIT

// TODO this is the result of a rabid day's coding. Clean

const Parse5 = require('parse5');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { promisify } = util;

const locateEnd = require('../../general/locate-end');
const processArgs = require('../../general/process-args');

const Connection = require('../../db/postgresql-connection');
const TemplatedText = require('../../dom/templated-text');
const templateCodeToJs = require('../../general/template-code-to-js');

async function execHaml(hamlPath) {
  const processedHamlDir = 'templates/processedHaml/',
    htmlPath = `${hamlPath.replace(/^templates\//, processedHamlDir)}.html`;
  await exec(`mkdir -p "$(dirname '${htmlPath}')"`);
  console.log(`haml --trace "${hamlPath}" "${htmlPath}"`);
  const { stdout, stderr, error } = await exec(`haml --trace "${hamlPath}" "${htmlPath}"`);
  //if (stdout.length) console.log(stdout);
  if (stderr.length) console.log(stderr);
  if (error) return;
  return await readFile_p(htmlPath, 'utf8');
}

const readFile_p = promisify(fs.readFile);
const readdir_p = promisify(fs.readdir);
const lstat_p = promisify(fs.lstat);

const appId = 1;
let connection;

// DB functions

async function getAppRow() {
  const rows = (await connection.query('SELECT * FROM app WHERE id = $1::integer', [appId])).rows;
  return rows && rows.length ? rows[0] : undefined;
}

async function nextDbRowId() {
  const rows = (await connection.query("SELECT nextval('template_id_seq');")).rows;
  return rows[0].nextval;
}

async function ensureAppRow() {
  if (await getAppRow()) return;
  console.log(`Creating app with id ${appId}`);
  await connection.query('INSERT INTO app(id) VALUES ($1::integer);', [appId]);
}

async function findTemplateByPath(path) {
  const rows = (await connection.query(
    'SELECT * FROM template WHERE app_id=$1::integer AND path=$2::character varying',
    [appId, path]
  )).rows;
  return rows.length ? rows[0] : undefined;
}

// file system

async function dealWithTemplatesDirectory({
  path,
  templatesById,
  newTemplates,
  templatesByPath,
  templatesByOwnershipClassVariant,
  args,
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
        templatesByPath,
        templatesByOwnershipClassVariant,
        args,
      });
    } else if (stat.isFile()) {
      await dealWithTemplateFile({
        path: filePath,
        templatesById,
        newTemplates,
        templatesByPath,
        templatesByOwnershipClassVariant,
        args,
      });
    }
  }
}

async function dealWithTemplateFile({
  path,
  templatesById,
  newTemplates,
  templatesByPath,
  templatesByOwnershipClassVariant,
  args,
}) {
  const templateFileRegex = /(?:^|\/)((my )?([\w]+)?(?:\[(\w+)\])?)(?:(\.haml)?\.html|\.haml)$/,
    match = templateFileRegex.exec(path);
  if (!match) {
    console.log(`Skipping '${path}' (unknown name format)`);
    return;
  }
  const ownerOnly = !!match[2],
    classFilter = match[3],
    variant = match[4];
  if (match[5]) return; // .haml.html files are ignored

  const templatesByClassVariant = (templatesByOwnershipClassVariant[ownerOnly] =
      templatesByOwnershipClassVariant[ownerOnly] || {}),
    templatesByVariant = (templatesByClassVariant[classFilter] = templatesByClassVariant[classFilter] || {});
  if (templatesByVariant[variant || 'default']) {
    console.log(
      `Skipping duplicate template at path ${path}, (the first file with this combination of ownership, class filter, and variant was at path ${
        templatesByVariant[variant || 'default'].path
      })`
    );
    return;
  }

  const row = await findTemplateByPath(path),
    dbRowId = row ? row.id : await nextDbRowId(),
    fileModifiedAt = '' + fs.statSync(path).mtime,
    modified = !row || row.file_modified_at != fileModifiedAt || args.all,
    includesTemplatePaths = row && row.includes_template_paths ? row.includes_template_paths.split('|') : [];

  template = {
    path,
    row,
    dbRowId,
    fileModifiedAt,
    modified,
    includesTemplatePaths,
    ownerOnly,
    classFilter,
    variant,

    displayedFields: {},
    subtemplates: {},
    children: {},

    mayHaveUnprocessedIncludes: true,
  };

  templatesByPath[template.path] = templatesByVariant[variant || 'default'] = template;

  if (row) templatesById[row.id] = template;
  else newTemplates.push(template);
}

// HTML and file processing

async function domForPath(path) {
  if (path.endsWith('.haml')) return await execHaml(path);
  else return await readFile_p(path, 'utf8');
}

async function processTemplateIncludes({ template, templatesByPath }, stack = {}) {
  if (!template.mayHaveUnprocessedIncludes) return;

  if (!(template.dom || (template.dom = await domForPath(template.path)))) {
    console.log(`Couldn't read template file at ${template.path}. Skipping`);
    return;
  }
  if (!(template.domTree || (template.domTree = Parse5.parseFragment(`${template.dom}`)))) {
    console.log(`Couldn't parse template file at ${template.path}. Skipping`);
    return;
  }

  template.domTree.childNodes[0].attrs.unshift({ name: 'sourcetemplate', value: String(template.dbRowId) });

  stack[template.path] = true;

  template.includesTemplatesByPath = {};

  async function checkForIncludeComment(node, nodeIndex, siblings, template, templatesByPath) {
    if (node.tagName == 'include') {
      const attrs = {},
        fields = {};
      node.attrs.forEach(({ name, value }) => {
        attrs[name] = value;
        const match = /^([\w-]+)_field$/.exec(name);
        if (match) {
          const { js } = templateCodeToJs(value);
          fields[match[1]] = js;
        }
      });

      const hasVariant = attrs.variant !== undefined,
        hasClassFilter = attrs.classfilter !== undefined,
        hasPublic = attrs.public;
      if (hasVariant || hasClassFilter || hasPublic) {
        const variant = attrs.variant || undefined,
          classFilter = attrs.classfilter || undefined;

        const tryClassFilters = hasClassFilter
            ? [classFilter]
            : template.classFilter
            ? [template.classFilter, undefined]
            : [undefined],
          tryVariants = hasVariant ? [variant] : template.variant ? [template.variant, undefined] : [undefined],
          tryOwnerships = hasPublic ? [false] : template.ownerOnly ? [true, false] : [false],
          tryCombos = [];
        for (const classFilter of tryClassFilters) {
          for (const variant of tryVariants) {
            for (const ownerOnly of tryOwnerships) {
              tryCombos.push([classFilter, variant, ownerOnly]);
            }
          }
        }

        let includedTemplate;
        for (const [classFilter, variant, ownerOnly] of tryCombos) {
          includedTemplate = Object.values(templatesByPath).find(
            template =>
              template.classFilter == classFilter && template.variant == variant && template.ownerOnly == ownerOnly
          );
          if (includedTemplate) break;
        }

        if (!includedTemplate) {
          console.log(`Could not find a template to use for an include tag in '${template.path}'
  Include tag has:
    ${hasClassFilter ? `classfilter=${classFilter}` : 'no classfilter specified'}
    ${hasVariant ? `variant=${variant}` : 'no variant specified'}
    ${hasPublic ? `public=true` : 'no public specifier'}
`);
          return;
        }

        attrs.path = includedTemplate.path;
      }
      if (attrs.path) {
        if (!templatesByPath[attrs.path]) {
          console.log(`Ignoring include of unknown template '${attrs.path}' in template '${template.path}'`);
        } else if (stack[attrs.path]) {
          console.log(
            `Ignoring recursive include tag in template '${template.path}'. Stack is ${JSON.stringify(stack)}`
          );
        } else {
          template.includesTemplatesByPath[attrs.path] = true;
          const subtemplate = templatesByPath[attrs.path];
          await processTemplateIncludes({ template: subtemplate, templatesByPath }, stack);
          if (!Object.keys(fields).length) {
            siblings.splice(nodeIndex, 1, ...subtemplate.processedRoots);
          } else {
            const newSiblings = Parse5.parseFragment(subtemplate.processedDom).childNodes;
            let index = 0;
            for (const newSibling of newSiblings) {
              substituteFields(subtemplate.processedRoots[index++], newSibling, fields);
            }
            siblings.splice(nodeIndex, 1, ...newSiblings);
          }
        }
      } else {
        console.log(`Ignoring include tag without path in template '${template.path}'`);
      }
      return;
    }

    if (node.childNodes) {
      let childIndex = 0;
      for (const child of node.childNodes) {
        await checkForIncludeComment(child, childIndex++, node.childNodes, template, templatesByPath);
      }
    }
  }

  let index = 0;
  for (const root of template.domTree.childNodes) {
    await checkForIncludeComment(root, index++, template.domTree.childNodes, template, templatesByPath);
  }

  exposeTemplates(template.domTree);
  assignLids(template.domTree);
  template.processedDom = Parse5.serialize(template.domTree);
  template.processedRoots = Parse5.parseFragment(template.processedDom || template.dom).childNodes;

  delete stack[template.path];
  delete template.mayHaveUnprocessedIncludes;
}

function substituteFields(originalElement, element, fields, fieldNames) {
  if (!originalElement.templateInfo) originalElement.templateInfo = scrapeTemplateInfo(originalElement);
  const templateInfo = originalElement.templateInfo;

  if (element.attrs) {
    for (const attr of element.attrs) {
      const { name, value } = attr;
      if (!name.endsWith('-template')) continue;

      fieldNames = fieldNames || Object.keys(fields).sort();

      const tree = locateEnd(value, false, 0);

      let prevEnd;
      const replacements = [];
      dealWithTree(tree, false);
      dealWithSegment(value.length, false);

      replacements.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

      prevEnd = 0;
      let newValue = '';
      for (const [at, end, fieldName] of replacements) {
        if (at < prevEnd) continue;
        newValue += value.substring(prevEnd, at) + fields[fieldName];
        prevEnd = end;
      }
      newValue += value.substring(prevEnd);

      attr.value = newValue;

      function dealWithTree({ range, type, children }, parentType) {
        const [start, end] = range;
        dealWithSegment(start, parentType);
        if (children) {
          for (const child of children) {
            dealWithTree(child, type);
          }
        }
        dealWithSegment(end === undefined ? value.length : end, type);
      }

      function dealWithSegment(end, type) {
        const start = prevEnd;
        prevEnd = end;
        if (start >= end) return;
        switch (type) {
          case '...':
          case '[]':
          case '{}':
          case '()':
          case '${}':
            let str = value.substring(start, end);
            for (const fieldName of fieldNames) {
              const regex = new RegExp(`\\b${fieldName}\\b`, 'g');
              let match,
                strIndex = 0;
              while ((match = regex.exec(str))) {
                replacements.push([match.index, match.index + match[0].length, fieldName]);
              }
            }
            break;
        }
      }
    }
  }

  if (element.childNodes) {
    let index = 0;
    for (const childNode of element.childNodes) {
      const originalChildNode = originalElement.childNodes[index++];
      substituteFields(originalChildNode, childNode, fields, fieldNames);
    }
  }

  return;
}

function scrapeTemplateInfo(element) {
  const ret = {};
  let index = 0;
  if (element.attrs) {
    for (const { name, value } of element.attrs) {
      if (!name.endsWith('-template')) continue;

      const templatedText = new TemplatedText({
        text: value,
      });
      if (!templatedText.dependencyTree) continue;

      dealWithChildren(value, ` ${name}`, 0, templatedText.dependencyTree.children);
    }
  }

  for (const indexes of Object.values(ret)) {
    indexes.sort((a, b) => a[0] - b[0]);
  }

  return ret;

  function dealWithChildren(string, retKey, rangeStart, children) {
    if (!children) return;
    for (const { code, range, children: subchildren } of children) {
      if (code && range) {
        const value = string.substring(rangeStart + range[0], rangeStart + range[1]);
        const indexes = (ret[retKey] = ret[retKey] || []);
        for (const name of Object.keys(code.names)) {
          if (value == `\${${name}}`) {
            indexes.push([[rangeStart + range[0], rangeStart + range[1]], name, false]);
          } else {
            const regex = new RegExp(`\\b${name}\\b`, 'g'); // TODO this is not the ideal way to detect where the name is used and could easily find false positives. It will do for now
            let match;
            while ((match = regex.exec(value))) {
              indexes.push([[rangeStart + match.index, rangeStart + match.index + name.length], name, true]);
            }
          }
        }
      }
      if (range && subchildren) {
        dealWithChildren(rangeStart + range[0], subchildren);
      }
    }
  }
}

function findAttribute(element, name) {
  if (!element.attrs) return;
  return element.attrs.find(attr => attr.name == name);
}

function findAttributeIndex(element, name) {
  if (!element.attrs) return -1;
  return element.attrs.indexOf(attr => attr.name == name);
}

function getAttribute(element, name) {
  if (!element.attrs) return;
  const attr = findAttribute(element, name);
  if (attr) return attr.value;
}

function setAttribute(element, name, value) {
  if (!element.attrs) {
    element.attrs = [{ name, value: String(value) }];
    return;
  }
  const attr = findAttribute(element, name);
  if (attr) attr.value = String(value);
  else element.attrs.push({ name, value: String(value) });
}

function removeAttribute(element, name) {
  if (!element.attrs) return;
  const index = findAttributeIndex(element, name);
  if (index >= 0) {
    if (element.attrs.length == 1) delete element.attrs;
    else element.attrs.splice(index, 1);
  }
}

function exposeTemplates(element) {
  const setAttrs = {};

  if (element.childNodes) {
    let textIndex = -1,
      inText = false,
      text = '',
      textNode;
    for (let childNodeIndex = 0; childNodeIndex <= element.childNodes.length; childNodeIndex++) {
      const childNode = childNodeIndex == element.childNodes.length ? undefined : element.childNodes[childNodeIndex];
      if (childNode && childNode.nodeName == '#text') {
        text += childNode.value;
        if (!inText) {
          textNode = childNode;
          textIndex++;
          inText = true;
        } else {
          childNode.value = '';
        }
      } else if (inText) {
        inText = false;
        const { js, literal } = templateCodeToJs(text);
        if (literal === undefined) {
          setAttrs[`textnode${textIndex}-template`] = js;
          textNode.value = '...';
        }
        text = '';
      }
    }
  }

  if (element.attrs) {
    for (const { name, value } of element.attrs) {
      if (name.startsWith('nobo-') || name == 'class' || name == 'id') continue;

      let { js, literal } = templateCodeToJs(value);
      if (literal !== undefined) continue;

      setAttrs[`${name}-template`] = js;
      setAttrs[name] = '...';
    }
  }

  for (const [name, value] of Object.entries(setAttrs)) setAttribute(element, name, value);

  if (element.childNodes) {
    for (const childNode of element.childNodes) {
      exposeTemplates(childNode);
    }
  }
}

function assignLids(element, lida = [0]) {
  const lid = lida[0]++;

  if (lid) setAttribute(element, 'nobo-lid', lid);

  if (element.childNodes) {
    for (const childNode of element.childNodes) {
      if (childNode && childNode.nodeName != '#text') {
        assignLids(childNode, lida);
      }
    }
  }
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

  const templatesByPath = {},
    templatesById = {},
    templatesByOwnershipClassVariant = {},
    newTemplates = [],
    templatesWas = (await connection.query('SELECT id from template;')).rows.map(row => row.id);

  let hadChanges = false;

  await dealWithTemplatesDirectory({
    path: templateDir,
    templatesByOwnershipClassVariant,
    templatesById,
    templatesByPath,
    newTemplates,
    args,
  });

  function getModified(template) {
    if (template.modified) return true;
    for (const path of template.includesTemplatePaths) {
      const includedTemplate = templatesByPath[path];
      if (!includedTemplate || includedTemplate.modified) return (template.modified = true);
      if (includedTemplate.unmodified) return false;
      if (getModified(includedTemplate)) return (template.modified = true);
    }
    template.unmodified = true;
    return false;
  }

  for (const template of Object.values(templatesByPath)) {
    if (!getModified(template)) continue;
    await processTemplateIncludes({ template, templatesByPath });
  }

  for (const template of Object.values(templatesById)) {
    if (!template.modified) continue;

    console.log(`Template: ${template.path} has changed dom or path`);
    hadChanges = true;
    await connection.query(
      'UPDATE template SET dom=$1::text, includes_template_paths=$2::text, path=$3::character varying, file_modified_at=$4::character varying WHERE id=$5::integer;',
      [
        template.processedDom || template.dom,
        Object.keys(template.includesTemplatesByPath).join('|'),
        template.path,
        template.fileModifiedAt,
        template.row.id,
      ]
    );

    template.modified = false;
  }

  for (const template of newTemplates) {
    console.log(`New template: ${template.path}`);
    hadChanges = true;
    await connection.query(
      'INSERT INTO template(id, app_id, class_filter, dom, includes_template_paths, path, file_modified_at, owner_only, variant) VALUES ($1::integer, $2::integer, $3::character varying, $4::text, $5::text, $6::character varying, $7::character varying, $8::boolean, $9::character varying);',
      [
        template.dbRowId,
        appId,
        template.classFilter,
        template.processedDom || template.dom,
        Object.keys(template.includesTemplatesByPath).join('|'),
        template.path,
        template.fileModifiedAt,
        template.ownerOnly,
        template.variant,
      ]
    );
    template.row = await findTemplateByPath(template.path);
    if (!template.row) {
      throw new Error('Failed to save template');
    }
    templatesById[template.row.id] = template;

    template.modified = false;
  }

  const deleteTemplates = templatesWas.filter(id => !templatesById[id]);
  if (deleteTemplates.length) {
    console.log(`Deleting ${deleteTemplates.length} template rows`);
    hadChanges = true;
    await connection.query('DELETE FROM template WHERE id = ANY ($1::integer[]);', [deleteTemplates]);
  }

  if (!hadChanges) {
    console.log('All templates were already up to date.');
  }
  console.log('Done');
})().then(() => process.exit(0));
