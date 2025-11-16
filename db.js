// db.js - IndexedDB helper
const DB_NAME = 'CreativeAnimationDB';
const STORE_NAME = 'settings';
const DB_VERSION = 1;

let db;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Error al abrir IndexedDB:', event);
            reject('Error al abrir la base de datos.');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

function setDirectoryHandle(handle) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(handle, 'projectsDirHandle');

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error al guardar el handle:', event);
            reject('No se pudo guardar la referencia a la carpeta.');
        };
    });
}

function getDirectoryHandle() {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('projectsDirHandle');

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error('Error al obtener el handle:', event);
            reject('No se pudo obtener la referencia a la carpeta.');
        };
    });
}
