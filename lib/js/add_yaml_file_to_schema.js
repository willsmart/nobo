const YAML = require("yamljs");

// API
module.exports = addYamlFileToSchema;

function addYamlFileToSchema({ filename, schema }) {
  let rootObject = YAML.load(filename);
  if (!Array.isArray(rootObject)) rootObject = [rootObject];
  rootObject.forEach(obj => {
    schema.addLayout(obj);
  });
}
