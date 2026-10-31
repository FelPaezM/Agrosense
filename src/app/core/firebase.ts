import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { environment } from '../../environments/environment';

export const fbApp = initializeApp(environment.firebase);
export const db = getFirestore(fbApp);
export const auth = getAuth(fbApp);
auth.languageCode = 'es';
