/**
 * Firebase Diagnostics Utility
 * Run this to test Firebase connectivity from the browser console:
 *   import { runFirebaseDiagnostics } from './src/data/diagnostics'
 *   runFirebaseDiagnostics()
 */
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from './firebase';

export async function runFirebaseDiagnostics(): Promise<void> {
  console.group('🔥 Firebase Diagnostics');
  console.log('Project ID:', 'sams-flutter-d6499');
  console.log('Firestore instance:', db);

  try {
    console.log('Testing Firestore connection...');
    const q = query(collection(db, 'users'), limit(1));
    const snap = await getDocs(q);
    console.log('✅ Firestore connected! Users collection:', snap.empty ? '(empty)' : `${snap.size} doc(s) found`);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      console.log('Sample user (password hidden):', { ...data, password: '***' });
    }
  } catch (err) {
    console.error('❌ Firestore error:', err);
    if (err instanceof Error && err.message.includes('permission')) {
      console.warn(
        '⚠️ PERMISSION DENIED — Your Firestore Security Rules are blocking unauthenticated reads.\n' +
        'Go to Firebase Console → Firestore → Rules and set:\n\n' +
        'rules_version = \'2\';\n' +
        'service cloud.firestore {\n' +
        '  match /databases/{database}/documents {\n' +
        '    match /{document=**} {\n' +
        '      allow read, write: if true;\n' +
        '    }\n' +
        '  }\n' +
        '}'
      );
    }
  }

  console.groupEnd();
}
