const fs = require('fs');
//const log = require('./log');
const PublicApi = require('./general/public-api');

const jsFileRegex = /\.js$/;

// API is auto-generated at the bottom from the public interface of this class

class Page {
  // public methods
  static publicMethods() {
    return ['page'];
  }

  constructor({ path, doCache = false } = {}) {
    const page = this;
    path = path || '.';
    page.doCache = doCache;
    if (fs.existsSync(`${path}/html`)) {
      page.htmlDir = fs.realpathSync(`${path}/html`);
    }
    if (fs.existsSync(`${path}/javascripts`)) {
      page.jsDir = fs.realpathSync(`${path}/javascripts`);
    }
  }

  get pageTemplate() {
    const page = this,
      { _pageTemplate } = page,
      { htmlDir } = page;
    if (_pageTemplate) return _pageTemplate;
    if (!htmlDir) return;
    const filename = `${htmlDir}/page.html`;
    if (!fs.existsSync(`${filename}`)) return;

    const ret = fs.readFileSync(filename, 'utf8');
    if (page.doCache) page._pageTemplate = ret;
    return ret;
  }

  get jsFiles() {
    const page = this;
    const dir = page.jsDir;
    if (!dir) return [];
    return fs
      .readdirSync(dir)
      .filter(filename => jsFileRegex.test(filename))
      .map(filename => `${dir}/${filename}`)
      .sort();
  }

  get page() {
    const page = this,
      { _pageBody } = this;

    if (_pageBody) return _pageBody;

    let { pageTemplate } = page;
    if (!pageTemplate) return;

    const jsScripts = page.jsFiles.map(filename => {
      const js = fs.readFileSync(filename, 'utf8');
      return `<script>${js}</script>`;
    });

    const endOfBodyIndex = /<\/body>/i.exec(pageTemplate).index;
    if (endOfBodyIndex == -1) return;

    const ret =
      pageTemplate.substring(0, endOfBodyIndex) + jsScripts.join('\n') + pageTemplate.substring(endOfBodyIndex);
    if (page.doCache) page._pageBody = ret;
    return ret;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: Page,
  hasExposedBackDoor: true,
});
