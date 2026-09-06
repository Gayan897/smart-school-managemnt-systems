import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyC_3178BD_7beTVrB9Ovn-DMZRYpW58ddg',
  appId: '1:707817556817:web:639b68dda0a8652f28a170',
  messagingSenderId: '707817556817',
  projectId: 'sams-flutter-d6499',
  authDomain: 'sams-flutter-d6499.firebaseapp.com',
  storageBucket: 'sams-flutter-d6499.firebasestorage.app',
  measurementId: 'G-0T1YGWDS58',
};

const app = initializeApp(firebaseConfig);

/**
 * Initialise Firestore with IndexedDB persistence so that:
 * - All reads are cached locally and served even when offline
 * - Writes made while offline are buffered and automatically
 *   flushed to Firestore once connectivity is restored
 * - Multiple browser tabs share the same IndexedDB cache
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const functions = getFunctions(app);

