import { IndexedDBWrapper } from "./db-storage";
import { LocalStorageWrapper } from "./local-storage";
export const localStorageWrapper = (db, table) => {
    return new LocalStorageWrapper(db, table);
};
export const dbStorageWrapper = (db, table) => {
    return new IndexedDBWrapper(db, table);
};
//# sourceMappingURL=index.js.map