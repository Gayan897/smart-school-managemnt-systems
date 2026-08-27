import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);
