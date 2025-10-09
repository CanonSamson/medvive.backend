import { getAdminFirestore } from './admin.js';
export const createDBAdmin = async (collectionName, docId, data) => {
    try {
        const db = getAdminFirestore();
        await db.collection(collectionName).doc(docId).set(data);
        return { success: true };
    }
    catch (error) {
        console.error('Error creating document:', error);
        throw error;
    }
};
export const updateDBAdmin = async (collectionName, docId, data) => {
    try {
        const db = getAdminFirestore();
        await db.collection(collectionName).doc(docId).update(data);
        return { success: true };
    }
    catch (error) {
        console.error('Error updating document:', error);
        throw error;
    }
};
export const getDBAdmin = async (collectionName, docId) => {
    try {
        const db = getAdminFirestore();
        const doc = await db.collection(collectionName).doc(docId).get();
        if (doc.exists) {
            return { data: doc.data(), success: true };
        }
        else {
            return { data: null, success: false, error: 'Document not found' };
        }
    }
    catch (error) {
        console.error('Error getting document:', error);
        throw error;
    }
};
export const deleteDBAdmin = async (collectionName, docId) => {
    try {
        const db = getAdminFirestore();
        await db.collection(collectionName).doc(docId).delete();
        return { success: true };
    }
    catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
};
export const checkIsExistsDBAdmin = async (collectionName, docId) => {
    try {
        const db = getAdminFirestore();
        const doc = await db.collection(collectionName).doc(docId).get();
        return doc.exists;
    }
    catch (error) {
        console.error('Error checking document existence:', error);
        throw error;
    }
};
//# sourceMappingURL=admin-database.js.map