import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const credentialsPath = path.resolve(process.cwd(), process.env.FIREBASE_CREDENTIALS!);
const serviceAccount = require(credentialsPath);

const app = initializeApp({
  credential: cert(serviceAccount)
});

export const db = getFirestore(app);