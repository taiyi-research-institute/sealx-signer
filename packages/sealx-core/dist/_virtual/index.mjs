import { getDefaultExportFromCjs } from './_commonjsHelpers.mjs';
import { __require as requireCryptoJs } from '../node_modules/crypto-js/index.mjs';

var cryptoJsExports = requireCryptoJs();
var CryptoJS = /*@__PURE__*/getDefaultExportFromCjs(cryptoJsExports);

export { CryptoJS as default };
//# sourceMappingURL=index.mjs.map
