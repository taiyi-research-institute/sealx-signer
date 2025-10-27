import { IndexedDBWrapper } from './db-storage.mjs';
import { LocalStorageWrapper } from './local-storage.mjs';

const localStorageWrapper = (db, table) => {
    return new LocalStorageWrapper(db, table);
};
const dbStorageWrapper = (db, table) => {
    return new IndexedDBWrapper(db, table);
};

export { dbStorageWrapper, localStorageWrapper };
//# sourceMappingURL=index.mjs.map
