import { IndexedDBWrapper } from "./db-storage"
import { LocalStorageWrapper } from "./local-storage"

export const localStorageWrapper = (db: string, table: string) => {
    return new LocalStorageWrapper(db, table)
}


export const dbStorageWrapper = (db: string, table: string) => {
    return new IndexedDBWrapper(db, table)
}